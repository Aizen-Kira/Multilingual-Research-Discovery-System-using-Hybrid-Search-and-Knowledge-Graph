"""
Phase 3 — Parallel Multi-Source + Multi-Language Fetch Agent

Strategy:
  - query_variants is List[Dict{"query": str, "lang": str}]
  - English variants  → ALL sources (arxiv, pubmed, crossref, europepmc, doaj)
  - Non-English variants → multilingual sources only (crossref, europepmc, doaj)
    because arxiv/pubmed do NOT meaningfully index non-English titles
  - Total tasks deduplicated by DOI and normalized title

Source resolution priority:
  1. ctx["sources_explicit"] = True  → use ctx["sources"] exactly as-is
  2. ctx["sources_explicit"] = False → ALWAYS expand to all 5 (safe default)
  3. ctx["sources"] missing/empty    → use ALL 5
"""
import asyncio
from typing import Any, AsyncGenerator, Dict, List, Set

from src.agents.base_agent import BaseAgent
from src.integrations.arxiv_client import arxiv_client
from src.integrations.pubmed_client import pubmed_client
from src.integrations.crossref_client import crossref_client
from src.integrations.europepmc_client import europepmc_client
from src.integrations.doaj_client import doaj_client
from src.integrations.ieee_client import ieee_client

SOURCE_MAP = {
    "arxiv":      arxiv_client,
    "pubmed":     pubmed_client,
    "crossref":   crossref_client,
    "europepmc":  europepmc_client,
    "doaj":       doaj_client,
    "ieee":       ieee_client,
}

ALL_SOURCES          = list(SOURCE_MAP.keys())
MULTILINGUAL_SOURCES = {"crossref", "europepmc", "doaj"}
ENGLISH_ONLY_SOURCES = {"arxiv", "pubmed", "ieee"}


class FetchAgent(BaseAgent):
    phase = 3
    name = "Multi-Source Fetch"

    async def run(self, ctx: Dict[str, Any]) -> AsyncGenerator[Dict, None]:

        # ── 1. Normalise query_variants ───────────────────────────────────────
        raw_variants = ctx.get("query_variants") or [ctx.get("query", "")]
        variants: List[Dict[str, str]] = []
        for v in raw_variants:
            if isinstance(v, str) and v.strip():
                variants.append({"query": v.strip(), "lang": "en"})
            elif isinstance(v, dict) and v.get("query", "").strip():
                variants.append({
                    "query": v["query"].strip(),
                    "lang":  v.get("lang", "en"),
                })

        if not variants:
            variants = [{"query": ctx.get("query", ""), "lang": "en"}]

        # ── 2. Source resolution ──────────────────────────────────────────────
        #
        # sources_explicit = True  → caller deliberately restricted the list
        # sources_explicit = False → expand to all 5 regardless of what was passed
        #
        raw_sources     = ctx.get("sources") or []
        sources_explicit = ctx.get("sources_explicit", False)

        if sources_explicit and raw_sources:
            # Honour caller's explicit list but validate names
            requested_sources = [s for s in raw_sources if s in SOURCE_MAP]
            if not requested_sources:
                self.logger.warning(
                    f"sources_explicit=True but all names invalid {raw_sources} "
                    f"→ falling back to all 5"
                )
                requested_sources = ALL_SOURCES
        else:
            # Default: always use all 5 sources
            requested_sources = ALL_SOURCES
            if raw_sources and set(raw_sources) != set(ALL_SOURCES):
                self.logger.info(
                    f"Partial source list {raw_sources} "
                    f"→ expanding to all 5 "
                    f"(pass sources_explicit=True in ctx to restrict)"
                )

        max_papers: int = ctx.get("max_papers", 30)

        active_sources = [s for s in requested_sources if s in SOURCE_MAP]
        if not active_sources:
            ctx["raw_papers"]    = []
            ctx["citation_ids"]  = []
            ctx["sources_used"]  = []
            yield self._event(status="done", found=0, sources=[])
            return

        # ── 3. Budget calculation ─────────────────────────────────────────────
        n_multilingual    = sum(1 for s in active_sources if s in MULTILINGUAL_SOURCES)
        n_english_only    = sum(1 for s in active_sources if s in ENGLISH_ONLY_SOURCES)
        en_variant_count  = sum(1 for v in variants if v["lang"] == "en")

        total_effective_tasks = (
            len(variants) * n_multilingual
            + en_variant_count * n_english_only
        )
        papers_per_variant = max(3, max_papers // max(total_effective_tasks, 1))

        # ── 4. Build task list ────────────────────────────────────────────────
        tasks:       List = []
        task_labels: List = []

        for src in active_sources:
            for v in variants:
                query_text = v["query"]
                lang       = v["lang"]

                # Skip English-only sources for non-English variants
                if src in ENGLISH_ONLY_SOURCES and lang != "en":
                    continue

                # Pass query_lang to clients that support it (crossref, europepmc, doaj)
                client = SOURCE_MAP[src]
                try:
                    import inspect
                    sig = inspect.signature(client.search_papers)
                    if "query_lang" in sig.parameters:
                        tasks.append(
                            client.search_papers(query_text, papers_per_variant, query_lang=lang)
                        )
                    else:
                        tasks.append(
                            client.search_papers(query_text, papers_per_variant)
                        )
                except Exception:
                    tasks.append(
                        client.search_papers(query_text, papers_per_variant)
                    )

                task_labels.append((src, lang, query_text[:40]))

        self.logger.info(
            f"Fetching: {len(active_sources)} sources × {len(variants)} variants "
            f"= {len(tasks)} effective tasks | "
            f"{papers_per_variant} papers/task | "
            f"sources={active_sources}"
        )

        if not tasks:
            ctx["raw_papers"]   = []
            ctx["citation_ids"] = []
            ctx["sources_used"] = active_sources
            yield self._event(status="done", found=0, sources=active_sources)
            return

        # ── 5. Fire all in parallel ───────────────────────────────────────────
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_papers:        List[Dict]         = []
        seen_dois:         Set[str]           = set()
        seen_title_source: Set[str]           = set()
        citation_ids:      List[str]          = []
        source_stats:      Dict[str, int]     = {s: 0 for s in active_sources}
        lang_stats:        Dict[str, int]     = {}
        fetch_errors:      Dict[str, int]     = {}

        for (src, lang, variant_label), result in zip(task_labels, results):
            if isinstance(result, Exception):
                self.logger.warning(
                    f"[{src}|lang={lang}|'{variant_label}'] fetch failed: {result}"
                )
                fetch_errors[src] = fetch_errors.get(src, 0) + 1
                continue

            for paper in result:
                title = (paper.get("title") or "").strip().lower()
                doi   = (paper.get("doi") or "").strip()

                # Deduplicate across multilingual results
                if doi and doi in seen_dois:
                    continue
                title_key = f"{title}|{src}"
                if title_key in seen_title_source:
                    continue

                if doi:
                    seen_dois.add(doi)
                seen_title_source.add(title_key)

                paper["_source"]         = src
                paper["source"]          = src
                paper["_query_variant"]  = variant_label
                paper["_query_lang"]     = lang

                all_papers.append(paper)
                source_stats[src]    = source_stats.get(src, 0) + 1
                lang_stats[lang]     = lang_stats.get(lang, 0) + 1

                for cid in paper.get("citation_ids", []):
                    citation_ids.append(cid)

        ctx["raw_papers"]   = all_papers
        ctx["citation_ids"] = list(set(citation_ids))
        ctx["sources_used"] = active_sources

        if fetch_errors:
            self.logger.warning(f"Fetch errors by source: {fetch_errors}")

        self.logger.info(
            f"Fetched {len(all_papers)} unique papers | "
            f"variants={len(variants)} | "
            f"per source={source_stats} | "
            f"per language={lang_stats}"
        )
        yield self._event(
            status="done",
            found=len(all_papers),
            sources=active_sources,
            variants_used=len(variants),
            per_source=source_stats,
            per_language=lang_stats,
            fetch_errors=fetch_errors,
        )
