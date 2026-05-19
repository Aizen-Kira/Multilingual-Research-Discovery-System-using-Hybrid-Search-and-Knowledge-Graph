"""
SSE Event Emitter Helper
Standardizes all SSE event shapes across the pipeline.
Every agent uses this to build consistent, typed events.
"""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional


class SSEEmitter:
    """
    Centralized SSE event builder.
    All events share a common envelope:
    {
        "phase":     int | str,
        "name":      str,
        "status":    str,
        "timestamp": ISO string,
        ...extra fields
    }
    """

    @staticmethod
    def _base(phase: Any, name: str, status: str, **kwargs) -> Dict:
        return {
            "phase": phase,
            "name": name,
            "status": status,
            "timestamp": datetime.now().isoformat(),
            **kwargs,
        }

    # ── Phase 0: Cache ────────────────────────────────────────────────────────
    @staticmethod
    def cache_checking() -> Dict:
        return SSEEmitter._base(0, "Redis Cache Check", "checking")

    @staticmethod
    def cache_hit() -> Dict:
        return SSEEmitter._base(0, "Redis Cache Check", "hit",
                                message="Returning cached result")

    @staticmethod
    def cache_miss() -> Dict:
        return SSEEmitter._base(0, "Redis Cache Check", "miss",
                                message="No cache match, running pipeline")

    # ── Phase 1: Language ─────────────────────────────────────────────────────
    @staticmethod
    def language_done(language: str, language_name: str, confidence: float) -> Dict:
        return SSEEmitter._base(1, "Language Detection", "done",
                                language=language,
                                language_name=language_name,
                                confidence=round(confidence, 3))

    # ── Phase 2: Translation ──────────────────────────────────────────────────
    @staticmethod
    def translation_done(variants: int, variant_list: List[str]) -> Dict:
        return SSEEmitter._base(2, "Query Translation", "done",
                                variants=variants,
                                variant_list=variant_list)

    # ── Phase 3: Fetch ────────────────────────────────────────────────────────
    @staticmethod
    def fetch_start(sources: List[str]) -> Dict:
        return SSEEmitter._base(3, "Multi-Source Fetch", "fetching",
                                sources=sources)

    @staticmethod
    def fetch_done(found: int, sources: List[str]) -> Dict:
        return SSEEmitter._base(3, "Multi-Source Fetch", "done",
                                found=found,
                                sources=sources)

    # ── Phase 4A: Validation ──────────────────────────────────────────────────
    @staticmethod
    def validation_done(before: int, after: int) -> Dict:
        return SSEEmitter._base("4A", "Quality Validation", "done",
                                before=before,
                                after=after,
                                filtered=before - after)

    # ── Phase 4B: Supabase Dedup ──────────────────────────────────────────────
    @staticmethod
    def dedup_checking() -> Dict:
        return SSEEmitter._base("4B", "Supabase Dedup", "checking")

    @staticmethod
    def dedup_done(new: int, reused: int) -> Dict:
        return SSEEmitter._base("4B", "Supabase Dedup", "done",
                                new=new,
                                reused=reused,
                                message=f"{new} new papers → LLM | {reused} reused from DB")

    # ── Phase 5: LLM Analysis ─────────────────────────────────────────────────
    @staticmethod
    def llm_start(total: int) -> Dict:
        return SSEEmitter._base(5, "LLM Analysis", "analyzing",
                                total=total)

    @staticmethod
    def llm_paper_done(index: int, total: int, title: str, layer: str) -> Dict:
        return SSEEmitter._base(5, "LLM Analysis", "paper_done",
                                index=index,
                                total=total,
                                title=title[:60],
                                layer_used=layer)

    @staticmethod
    def llm_done(analyzed: int, layer_used: str) -> Dict:
        return SSEEmitter._base(5, "LLM Analysis", "done",
                                analyzed=analyzed,
                                layer_used=layer_used)

    @staticmethod
    def llm_skip() -> Dict:
        return SSEEmitter._base(5, "LLM Analysis", "skip",
                                message="No new papers to analyze")

    # ── Phase 6: Embeddings ───────────────────────────────────────────────────
    @staticmethod
    def embedding_start(count: int) -> Dict:
        return SSEEmitter._base(6, "Embeddings & Vector Search", "generating",
                                count=count)

    @staticmethod
    def embedding_done(embeddings_generated: int, db_similar: int) -> Dict:
        return SSEEmitter._base(6, "Embeddings & Vector Search", "done",
                                embeddings_generated=embeddings_generated,
                                db_similar=db_similar)

    # ── Phase 7: Storage ──────────────────────────────────────────────────────
    @staticmethod
    def storage_start() -> Dict:
        return SSEEmitter._base(7, "Store to Supabase", "storing")

    @staticmethod
    def storage_done(new_stored: int, reused: int) -> Dict:
        return SSEEmitter._base(7, "Store to Supabase", "done",
                                new_stored=new_stored,
                                reused=reused)

    # ── Phase 8: Relationships ────────────────────────────────────────────────
    @staticmethod
    def relationship_start() -> Dict:
        return SSEEmitter._base(8, "Relationship Discovery", "discovering")

    @staticmethod
    def relationship_progress(source: str, found: int) -> Dict:
        return SSEEmitter._base(8, "Relationship Discovery", "progress",
                                source=source,
                                found_so_far=found)

    @staticmethod
    def relationship_done(relationships: int) -> Dict:
        return SSEEmitter._base(8, "Relationship Discovery", "done",
                                relationships=relationships)

    # ── Phase 9: Research Gaps ────────────────────────────────────────────────
    @staticmethod
    def gap_start() -> Dict:
        return SSEEmitter._base(9, "Research Gap Detection", "detecting")

    @staticmethod
    def gap_done(gaps: List[str]) -> Dict:
        return SSEEmitter._base(9, "Research Gap Detection", "done",
                                gaps=gaps,
                                gap_count=len(gaps))

    # ── Phase 10: Graph ───────────────────────────────────────────────────────
    @staticmethod
    def graph_start() -> Dict:
        return SSEEmitter._base(10, "Knowledge Graph Build", "building")

    @staticmethod
    def graph_done(nodes: int, edges: int) -> Dict:
        return SSEEmitter._base(10, "Knowledge Graph Build", "done",
                                nodes=nodes,
                                edges=edges)

    # ── Phase 11: Cache Store ─────────────────────────────────────────────────
    @staticmethod
    def cache_stored(ttl: int) -> Dict:
        return SSEEmitter._base(11, "Cache Store", "done",
                                ttl_seconds=ttl)

    # ── Error ─────────────────────────────────────────────────────────────────
    @staticmethod
    def error(phase: Any, name: str, message: str) -> Dict:
        return SSEEmitter._base(phase, name, "error",
                                error=message)

    # ── Final Complete ────────────────────────────────────────────────────────
    @staticmethod
    def complete(
        query: str,
        papers_found: int,
        papers_analyzed: int,
        papers_stored: int,
        relationships_found: int,
        research_gaps: List[str],
        processing_time: float,
        from_cache: bool,
        detected_language: Dict,
        papers: List[Dict],
        relationships: List[Dict],
        graph: Dict,
        metadata: Dict,
    ) -> Dict:
        return {
            "phase": "complete",
            "name": "Pipeline Complete",
            "status": "done",
            "success": True,
            "timestamp": datetime.now().isoformat(),
            # Summary
            "query": query,
            "detected_language": detected_language,
            "papers_found": papers_found,
            "papers_analyzed": papers_analyzed,
            "papers_stored": papers_stored,
            "relationships_found": relationships_found,
            "research_gaps": research_gaps,
            "processing_time": round(processing_time, 2),
            "from_cache": from_cache,
            # Full payloads
            "papers": papers,
            "relationships": relationships,
            "graph": graph,
            "metadata": metadata,
        }

    # ── Format as raw SSE wire string ─────────────────────────────────────────
    @staticmethod
    def to_sse(event: Dict) -> str:
        """
        Converts event dict → SSE wire format string.
        Use this when manually writing to StreamingResponse.
        """
        return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    @staticmethod
    def to_sse_named(event_name: str, event: Dict) -> str:
        """Named SSE event (for 'done' terminal event)."""
        return f"event: {event_name}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"


# Global singleton
sse = SSEEmitter()
