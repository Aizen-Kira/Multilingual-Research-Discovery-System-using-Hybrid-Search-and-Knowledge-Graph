"""
Pipeline Orchestrator v3.2
Wires all 11 phases together with proper SSEEmitter events.

Fixes:
  - sources ALWAYS defaults to all 5; partial lists are expanded unless
    sources_explicit=True is passed by the caller
  - query_variants serialized safely for SSE (List[Dict] → List[str])
"""
import asyncio
import hashlib
import logging
import time
from typing import Any, AsyncGenerator, Dict, List

from src.agents import (
    LanguageAgent, TranslationAgent, FetchAgent, ValidationAgent,
    LLMAgent, EmbeddingAgent, StorageAgent, RelationshipAgent,
    GapAgent, GraphAgent,
)
from src.pipeline.sse_emitter import sse
from src.cache.redis_cache import redis_cache
from src.database.supabase_client import supabase_client
from src.core.embeddings import embedding_generator
from src.config.settings import settings

logger = logging.getLogger(__name__)

ALL_SOURCES  = ["arxiv", "pubmed", "crossref", "europepmc", "doaj"]
_VALID_SOURCES = set(ALL_SOURCES)


def _resolve_sources(requested: List[str] | None, explicit: bool) -> List[str]:
    """
    Return the final source list to put in ctx.

    Rules:
      - None or []          → ALL 5  (caller did not restrict)
      - non-empty + explicit=True  → honour caller's list (validated)
      - non-empty + explicit=False → expand to ALL 5 and log a warning
    """
    cleaned = [s for s in (requested or []) if s in _VALID_SOURCES]
    if not cleaned:
        return ALL_SOURCES
    if explicit:
        return cleaned
    # Caller sent a partial list without opting in → silently expand
    if set(cleaned) != _VALID_SOURCES:
        logger.warning(
            f"Partial source list {cleaned} received without sources_explicit=True "
            f"→ expanding to all 5 sources"
        )
    return ALL_SOURCES


class PipelineOrchestrator:
    """
    Executes all pipeline phases sequentially.
    Yields SSE-ready dicts for StreamingResponse.
    Maintains a shared `ctx` dict that agents read/write.
    """

    def __init__(self):
        self._llm_agent = LLMAgent()

    async def run(
        self,
        query: str,
        sources: List[str] | None = None,
        max_papers: int = 30,
        sources_explicit: bool = False,
    ) -> AsyncGenerator[Dict, None]:

        start = time.time()

        # ── Source resolution ─────────────────────────────────────────────────
        # sources_explicit=True  → honour the caller's list exactly
        # sources_explicit=False → always expand to all 5 (safe default)
        resolved_sources = _resolve_sources(sources, sources_explicit)

        ctx: Dict[str, Any] = {
            "query":            query,
            "sources":          resolved_sources,   # guaranteed all 5 by default
            "sources_explicit": sources_explicit,   # FetchAgent reads this too
            "max_papers":       max_papers,
        }

        logger.info(
            f"Pipeline start | query='{query[:50]}' | "
            f"sources={resolved_sources} | max_papers={max_papers}"
        )

        # ══════════════════════════════════════════════════════
        # PHASE 0 — Redis Semantic Cache Check
        # ══════════════════════════════════════════════════════
        yield sse.cache_checking()

        cache_hit = await self._check_semantic_cache(query, ctx)
        if cache_hit:
            yield sse.cache_hit()
            yield {**cache_hit, "from_cache": True, "phase": "complete"}
            return

        yield sse.cache_miss()

        # ══════════════════════════════════════════════════════
        # PHASE 1 — Language Detection
        # ══════════════════════════════════════════════════════
        async for event in LanguageAgent().run(ctx):
            yield event

        # ══════════════════════════════════════════════════════
        # PHASE 2 — Query Translation
        # ══════════════════════════════════════════════════════
        async for event in TranslationAgent().run(ctx):
            yield event

        # ══════════════════════════════════════════════════════
        # PHASE 3 — Parallel Multi-Source Fetch
        # ══════════════════════════════════════════════════════
        yield sse.fetch_start(ctx.get("sources", []))
        async for event in FetchAgent().run(ctx):
            yield event

        # ══════════════════════════════════════════════════════
        # PHASE 4A — Quality Validation
        # ══════════════════════════════════════════════════════
        async for event in ValidationAgent().run(ctx):
            yield event

        # ══════════════════════════════════════════════════════
        # PHASE 4B — Supabase Dedup
        # ══════════════════════════════════════════════════════
        yield sse.dedup_checking()
        await self._supabase_dedup(ctx)
        yield sse.dedup_done(
            new=len(ctx.get("new_papers", [])),
            reused=len(ctx.get("reused_papers", [])),
        )

        # ══════════════════════════════════════════════════════
        # PHASE 5 — LLM Analysis (new papers only)
        # ══════════════════════════════════════════════════════
        new_papers = ctx.get("new_papers", [])
        if new_papers:
            yield sse.llm_start(len(new_papers))
        async for event in self._llm_agent.run(ctx):
            yield event

        # Build query embedding from analyzed new papers
        new_analyzed = ctx.get("analyzed_new_papers", [])
        if new_analyzed:
            loop = asyncio.get_event_loop()
            q_text = (
                f"{query} "
                + " ".join(p.get("title", "") for p in new_analyzed[:3])
            )
            ctx["query_embedding"] = await loop.run_in_executor(
                None,
                lambda: embedding_generator.generate_embedding(q_text),
            )

        # ══════════════════════════════════════════════════════
        # PHASE 6 — Embeddings + Vector Search
        # ══════════════════════════════════════════════════════
        yield sse.embedding_start(len(new_analyzed))
        async for event in EmbeddingAgent().run(ctx):
            yield event

        # ══════════════════════════════════════════════════════
        # PHASE 7 — Store to Supabase
        # ══════════════════════════════════════════════════════
        yield sse.storage_start()
        async for event in StorageAgent().run(ctx):
            yield event

        # ══════════════════════════════════════════════════════
        # PHASE 8 — Relationship Discovery
        # ══════════════════════════════════════════════════════
        yield sse.relationship_start()
        async for event in RelationshipAgent(llm_agent=self._llm_agent).run(ctx):
            yield event

        # ══════════════════════════════════════════════════════
        # PHASE 9 — Research Gap Detection
        # ══════════════════════════════════════════════════════
        yield sse.gap_start()
        async for event in GapAgent(llm_agent=self._llm_agent).run(ctx):
            yield event

        # ══════════════════════════════════════════════════════
        # PHASE 10 — Knowledge Graph Build
        # ══════════════════════════════════════════════════════
        yield sse.graph_start()
        async for event in GraphAgent().run(ctx):
            yield event

        # ══════════════════════════════════════════════════════
        # PHASE 11 — Cache Result + Background Prefetch
        # ══════════════════════════════════════════════════════
        processing_time = time.time() - start
        final_result = self._build_final_result(ctx, processing_time)

        asyncio.create_task(self._store_cache(query, ctx, final_result))
        asyncio.create_task(self._background_prefetch(ctx))

        yield sse.cache_stored(ttl=settings.CACHE_TTL)

        # ══════════════════════════════════════════════════════
        # FINAL — Complete event
        # ══════════════════════════════════════════════════════
        all_papers = ctx.get("all_stored_papers", [])
        serialized_variants = _serialize_variants(ctx.get("query_variants", []))

        yield sse.complete(
            query=query,
            papers_found=len(ctx.get("raw_papers", [])),
            papers_analyzed=len(new_analyzed),
            papers_stored=len(all_papers),
            relationships_found=len(ctx.get("relationships", [])),
            research_gaps=ctx.get("research_gaps", []),
            processing_time=processing_time,
            from_cache=False,
            detected_language=ctx.get("detected_language", {}),
            papers=all_papers,
            relationships=ctx.get("relationships", []),
            graph=ctx.get("graph", {}),
            metadata={
                "sources_used":   ctx.get("sources_used", []),
                "query_variants": serialized_variants,
                "db_cache_hits":  len(ctx.get("reused_papers", [])),
                "version":        settings.VERSION,
                "timestamp":      __import__("datetime").datetime.now().isoformat(),
            },
        )
        logger.info(f"✅ Pipeline complete | {processing_time:.2f}s | {len(all_papers)} papers")

    # ══════════════════════════════════════════════════════════
    # HELPERS
    # ══════════════════════════════════════════════════════════

    async def _check_semantic_cache(self, query: str, ctx: Dict) -> Dict | None:
        """Scan Redis for semantically similar cached query (cosine ≥ threshold)."""
        try:
            loop = asyncio.get_event_loop()
            q_emb = await loop.run_in_executor(
                None,
                lambda: embedding_generator.generate_embedding(query),
            )
            ctx["query_embedding"] = q_emb

            keys = await redis_cache.scan_keys("polyresearch:query:*")
            for key in keys:
                cached = await redis_cache.get(key)
                if not cached:
                    continue
                cached_emb = cached.get("query_embedding")
                if not cached_emb:
                    continue
                sim = embedding_generator.cosine_similarity(q_emb, cached_emb)
                if sim >= settings.REDIS_SEMANTIC_CACHE_THRESHOLD:
                    logger.info(f"🎯 Cache HIT key={key} similarity={sim:.3f}")
                    return cached.get("result")
        except Exception as e:
            logger.warning(f"Cache check error: {e}")
        return None

    async def _supabase_dedup(self, ctx: Dict):
        """
        Split validated papers into:
          - new_papers    → need LLM analysis
          - reused_papers → pull full analysis from DB
        """
        validated: List[Dict] = ctx.get("validated_papers", [])
        if not validated:
            ctx["new_papers"] = []
            ctx["reused_papers"] = []
            return

        titles = [p.get("title", "") for p in validated if p.get("title")]
        try:
            existing = await supabase_client.batch_title_lookup(titles)
            existing_map = {
                e["title"].lower(): e for e in existing if e.get("title")
            }
        except Exception as e:
            logger.warning(f"Supabase dedup failed (all treated as new): {e}")
            ctx["new_papers"] = validated
            ctx["reused_papers"] = []
            return

        new_papers: List[Dict] = []
        reused_papers: List[Dict] = []

        for paper in validated:
            title_key = (paper.get("title") or "").lower()
            if title_key in existing_map:
                db_record = existing_map[title_key]
                merged = {**paper}
                for field in (
                    "id", "research_domain", "methodology", "key_findings",
                    "innovations", "limitations", "contributions",
                    "context_summary", "quality_score", "ai_agent_used",
                    "analysis_method", "embedding",
                ):
                    if db_record.get(field) is not None:
                        merged[field] = db_record[field]
                reused_papers.append(merged)
            else:
                new_papers.append(paper)

        ctx["new_papers"] = new_papers
        ctx["reused_papers"] = reused_papers

        logger.info(
            f"Dedup: {len(new_papers)} new → LLM | "
            f"{len(reused_papers)} reused from DB"
        )

    async def _store_cache(self, query: str, ctx: Dict, result: Dict):
        """Store final result in Redis with semantic embedding key."""
        try:
            q_emb = ctx.get("query_embedding")
            key_seed = str(q_emb[:10]) if q_emb else query
            key_hash = hashlib.md5(key_seed.encode()).hexdigest()
            await redis_cache.set(
                f"polyresearch:query:{key_hash}",
                {"query_embedding": q_emb, "result": result},
                ttl=settings.CACHE_TTL,
            )
            logger.info(f"📦 Cached result key_hash={key_hash[:8]}")
        except Exception as e:
            logger.warning(f"Cache store failed: {e}")

    async def _background_prefetch(self, ctx: Dict):
        """
        Warm Redis cache for likely follow-up queries.
        Non-blocking — runs via create_task after response is sent.
        """
        try:
            graph = ctx.get("graph", {})
            clusters = graph.get("clusters", [])
            for cluster in clusters[:3]:
                domain = cluster.get("label", "")
                if domain and domain != "General Research":
                    await asyncio.sleep(2)
                    logger.debug(f"🔄 Background prefetch: {domain}")
        except Exception as e:
            logger.debug(f"Prefetch error (non-critical): {e}")

    def _build_final_result(self, ctx: Dict, processing_time: float) -> Dict:
        """Build the complete final result dict for Redis storage."""
        all_papers = ctx.get("all_stored_papers", [])
        return {
            "success":            True,
            "query":              ctx.get("query"),
            "detected_language":  ctx.get("detected_language", {}),
            "papers_found":       len(ctx.get("raw_papers", [])),
            "papers_analyzed":    len(ctx.get("analyzed_new_papers", [])),
            "papers_stored":      len(all_papers),
            "relationships_found": len(ctx.get("relationships", [])),
            "research_gaps":      ctx.get("research_gaps", []),
            "papers":             all_papers,
            "relationships":      ctx.get("relationships", []),
            "graph":              ctx.get("graph", {}),
            "processing_time":    round(processing_time, 2),
            "from_cache":         False,
            "metadata": {
                "sources_used":   ctx.get("sources_used", []),
                "query_variants": _serialize_variants(ctx.get("query_variants", [])),
                "db_cache_hits":  len(ctx.get("reused_papers", [])),
                "version":        settings.VERSION,
                "timestamp":      __import__("datetime").datetime.now().isoformat(),
            },
        }


def _serialize_variants(variants) -> List[str]:
    """Safely convert List[Dict|str] → List[str] for SSE / Redis serialization."""
    out = []
    for v in variants:
        if isinstance(v, dict):
            out.append(v.get("query", ""))
        elif isinstance(v, str):
            out.append(v)
    return [s for s in out if s]
