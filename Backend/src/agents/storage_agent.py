"""
Phase 7 — Store to Supabase Agent

Key flow: LLMAgent writes ctx['analyzed_papers']
          EmbeddingAgent reads + writes ctx['analyzed_papers'] (with embeddings)
          StorageAgent reads ctx['analyzed_papers']  ← this file

Language detection:
  - ALWAYS detect from title+abstract content (never trust source 'language' field)
  - Uses langdetect with 80% confidence threshold
  - Falls back to paper's own language field if detection is uncertain
"""
import logging
from typing import Any, AsyncGenerator, Dict, List

from src.agents.base_agent import BaseAgent
from src.database.supabase_client import supabase_client

logger = logging.getLogger(__name__)

# ── langdetect setup ──────────────────────────────────────────────────────────
try:
    from langdetect import detect_langs as _detect_langs_fn
    _LANGDETECT_OK = True
except ImportError:
    _LANGDETECT_OK = False
    logger.warning("langdetect not installed — language detection disabled, falling back to source field")


def _detect_paper_language(paper: Dict) -> str:
    """
    Detect language from actual paper content (title + abstract).

    Why not trust paper['language'] from arxiv/pubmed:
      - Both sources hardcode 'en' for virtually all papers.
      - CrossRef provides correct lang tags; EuropePMC is mixed.
      - Only content-based detection is reliable across all sources.

    Confidence threshold: 80% — below this we fall back to the
    source-provided field (which at least CrossRef gets right).
    """
    title = (paper.get("title") or "").strip()
    abstract = (paper.get("abstract") or "").strip()
    text = f"{title}. {abstract}".strip()

    # Source-provided field as fallback (CrossRef is trustworthy here)
    src_lang = (paper.get("language") or "en").strip()[:5]
    if src_lang in ("", "eng"):
        src_lang = "en"

    # Too short to detect reliably → trust source field
    if len(text) < 50:
        return src_lang

    if not _LANGDETECT_OK:
        return src_lang

    try:
        results = _detect_langs_fn(text[:600])
        if not results:
            return src_lang

        top = results[0]
        # Accept detection only if confidence ≥ 80%
        if top.prob >= 0.80:
            return top.lang

        # Medium confidence: cross-check against source field
        # If they agree on non-English, trust it
        if top.lang == src_lang and src_lang != "en":
            return src_lang

        # Low confidence or conflict — fall back to source field
        return src_lang

    except Exception:
        return src_lang


class StorageAgent(BaseAgent):
    phase = 7
    name = "Store to Supabase"

    async def run(self, ctx: Dict[str, Any]) -> AsyncGenerator[Dict, None]:
        # Reads 'analyzed_papers' — written by LLMAgent, embeddings added by EmbeddingAgent
        new_papers: List[Dict] = ctx.get("analyzed_papers", [])
        reused_papers: List[Dict] = ctx.get("reused_papers", [])

        stored: List[Dict] = []
        lang_stats: Dict[str, int] = {}

        # ── INSERT new papers ─────────────────────────────────────────────────
        for paper in new_papers:
            try:
                # Detect language from content — overrides whatever source sent
                paper_lang = _detect_paper_language(paper)
                paper["language"] = paper_lang
                lang_stats[paper_lang] = lang_stats.get(paper_lang, 0) + 1

                paper_id = await supabase_client.store_paper(paper)
                paper["id"] = paper_id
                paper["persisted"] = bool(paper_id)
                stored.append(paper)

            except Exception as e:
                self.logger.error(
                    f"Failed to store paper '{paper.get('title', '?')[:40]}': {e}"
                )
                paper["persisted"] = False
                stored.append(paper)

        # ── UPDATE last_accessed for cache-hit (reused) papers ────────────────
        for paper in reused_papers:
            try:
                paper_id = paper.get("id")
                if paper_id:
                    await supabase_client.update_last_accessed(paper_id)
                paper["persisted"] = True
                stored.append(paper)
            except Exception as e:
                self.logger.warning(
                    f"Failed to update last_accessed for id={paper.get('id')}: {e}"
                )
                stored.append(paper)

        ctx["all_stored_papers"] = stored

        persisted_count = sum(1 for p in stored if p.get("persisted"))
        self.logger.info(
            f"StorageAgent: {persisted_count}/{len(stored)} persisted | "
            f"new={len(new_papers)} reused={len(reused_papers)} | "
            f"languages: {lang_stats}"
        )
        yield self._event(
            status="done",
            new_stored=len(new_papers),
            reused=len(reused_papers),
            language_breakdown=lang_stats,
        )
