"""
Phase 4A — Pre-LLM Quality Validation Agent

Pipeline:
  1. Filter by quality rules (title, abstract length, age, dedup)
  1.5 ← NEW: Semantic relevance filter vs query embedding
  2. Priority-score survivors
  3. HARD CAP at LLM_ANALYSIS_LIMIT
  4. Supabase dedup
"""
from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List, Set

from src.agents.base_agent import BaseAgent
from src.config.settings import settings
from src.database.supabase_client import supabase_client
from src.core.embeddings import embedding_generator


SOURCE_WEIGHTS = {
    "pubmed":    1.0,
    "europepmc": 0.95,
    "arxiv":     0.90,
    "crossref":  0.80,
    "doaj":      0.75,
}

# Minimum cosine similarity between paper (title+abstract) and query embedding
# Papers below this are off-topic and dropped before LLM/storage
RELEVANCE_THRESHOLD = 0.30    # tune: 0.25 = permissive, 0.35 = strict


def _priority_score(paper: Dict, current_year: int) -> float:
    """Score 0.0–1.0: recency (40%) + abstract richness (35%) + source trust (25%)"""
    score = 0.0

    pub_date = paper.get("published_date") or ""
    try:
        year = int(str(pub_date)[:4])
        age = current_year - year
        recency = (
            1.0 if age <= 1 else
            0.8 if age <= 3 else
            0.6 if age <= 5 else
            0.4 if age <= 7 else 0.2
        )
    except Exception:
        recency = 0.3
    score += recency * 0.40

    word_count = len((paper.get("abstract") or "").split())
    richness = (
        1.0 if word_count >= 200 else
        0.75 if word_count >= 100 else
        0.5 if word_count >= 50 else 0.25
    )
    score += richness * 0.35

    trust = SOURCE_WEIGHTS.get(
        paper.get("source") or paper.get("_source") or "", 0.6
    )
    score += trust * 0.25

    return round(score, 4)


class ValidationAgent(BaseAgent):
    phase = 4
    name = "Quality Validation"

    async def run(self, ctx: Dict[str, Any]) -> AsyncGenerator[Dict, None]:
        raw: List[Dict] = ctx.get("raw_papers", [])
        current_year = datetime.now().year
        cutoff_year = current_year - settings.MAX_PAPER_AGE_YEARS
        llm_limit = settings.LLM_ANALYSIS_LIMIT

        seen_dois: set = set()
        seen_title_src: set = set()
        valid: List[Dict] = []

        # ── Step 1: Quality filter ────────────────────────────────────────────
        for paper in raw:
            title    = (paper.get("title") or "").strip()
            abstract = paper.get("abstract") or ""
            source   = paper.get("source") or paper.get("_source") or ""
            doi      = paper.get("doi") or ""

            if len(title) < 3:
                continue
            if len(abstract.split()) < settings.MIN_ABSTRACT_WORDS:
                continue

            pub_date = paper.get("published_date") or ""
            try:
                if int(str(pub_date)[:4]) < cutoff_year:
                    continue
            except Exception:
                pass

            if doi:
                if doi in seen_dois:
                    continue
                seen_dois.add(doi)

            key = f"{title.lower()}|{source}"
            if key in seen_title_src:
                continue
            seen_title_src.add(key)

            paper["_priority_score"] = _priority_score(paper, current_year)
            valid.append(paper)

        total_after_quality = len(valid)

        # ── Step 1.5: Semantic relevance filter ───────────────────────────────
        # Drop papers that are topically unrelated to the query.
        # This catches multilingual false positives:
        #   e.g. French query "Intelligence artificielle" hitting a film-studies paper,
        #        Korean/Japanese variants matching medical history papers.
        #
        # Uses query_embedding already computed by orchestrator in Phase 0.
        # For each paper, embed title+abstract and compare cosine similarity.
        query_embedding = ctx.get("query_embedding")
        relevant_dropped = 0

        if query_embedding:
            import asyncio
            relevant: List[Dict] = []

            # Batch-embed all paper texts in one executor call for speed
            paper_texts = [
                f"{p.get('title', '')} {(p.get('abstract') or '')[:300]}"
                for p in valid
            ]

            loop = asyncio.get_event_loop()
            try:
                paper_embeddings = await loop.run_in_executor(
                    None,
                    lambda: [
                        embedding_generator.generate_embedding(t)
                        for t in paper_texts
                    ],
                )

                for paper, emb in zip(valid, paper_embeddings):
                    sim = embedding_generator.cosine_similarity(query_embedding, emb)
                    paper["_relevance_score"] = round(sim, 4)

                    if sim >= RELEVANCE_THRESHOLD:
                        relevant.append(paper)
                    else:
                        relevant_dropped += 1
                        self.logger.debug(
                            f"Relevance DROP [{paper.get('source')}] "
                            f"sim={sim:.3f} < {RELEVANCE_THRESHOLD} | "
                            f"'{(paper.get('title') or '')[:50]}'"
                        )

                valid = relevant

            except Exception as e:
                self.logger.warning(
                    f"Relevance filter failed (keeping all {len(valid)} papers): {e}"
                )
                # Graceful degradation — don't block the pipeline

        self.logger.info(
            f"Quality filter: {len(raw)} raw → {total_after_quality} quality-valid | "
            f"Relevance filter: dropped {relevant_dropped} off-topic → "
            f"{len(valid)} relevant papers remain"
        )

        # ── Step 2: Priority sort + HARD CAP ─────────────────────────────────
        valid.sort(key=lambda p: p["_priority_score"], reverse=True)
        top_papers = valid[:llm_limit]
        discarded = len(valid) - len(top_papers)

        self.logger.info(
            f"Top {len(top_papers)} selected for LLM | "
            f"{discarded} discarded (below hard cap of {llm_limit})"
        )

        # ── Step 3: Supabase dedup ────────────────────────────────────────────
        stored_dois: Set[str] = set()
        stored_titles: Set[str] = set()
        try:
            existing = await supabase_client.get_existing_paper_keys()
            stored_dois   = existing.get("dois", set())
            stored_titles = existing.get("titles", set())
            self.logger.info(
                f"Supabase dedup: {len(stored_dois)} existing DOIs, "
                f"{len(stored_titles)} existing titles"
            )
        except Exception as e:
            self.logger.warning(f"Supabase dedup check failed (proceeding anyway): {e}")

        new_papers: List[Dict] = []
        skipped_existing = 0

        for paper in top_papers:
            doi       = paper.get("doi") or ""
            title_key = (paper.get("title") or "").strip().lower()

            if doi and doi in stored_dois:
                skipped_existing += 1
                new_papers.append(paper)
                continue
            if title_key and title_key in stored_titles:
                skipped_existing += 1
                new_papers.append(paper)
                continue

            new_papers.append(paper)

        # Pass ALL valid top papers to orchestrator for dedup & processing
        ctx["validated_papers"] = top_papers

        self.logger.info(
            f"Final batch: {len(new_papers)} NEW papers → LLM & storage | "
            f"{skipped_existing} already in Supabase (skipped) | "
            f"{relevant_dropped} off-topic (relevance filter) | "
            f"{discarded} discarded (below hard cap)"
        )
        yield self._event(
            status="done",
            raw=len(raw),
            quality_valid=total_after_quality,
            relevant=len(valid),
            off_topic_dropped=relevant_dropped,
            top_selected=len(top_papers),
            already_stored=skipped_existing,
            discarded=discarded,
            new_to_process=len(new_papers),
            llm_limit=llm_limit,
        )
