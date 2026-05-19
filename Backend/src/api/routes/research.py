"""
SSE Streaming Research Route
GET /api/research/stream?query=...&sources=arxiv,pubmed&max_papers=30
"""
import asyncio
import json
import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.api.security import require_public_api_access
from src.pipeline.orchestrator import PipelineOrchestrator

logger = logging.getLogger(__name__)
router = APIRouter(tags=["research"])


async def event_stream(query: str, sources: list, max_papers: int):
    """Generate SSE events from pipeline orchestrator."""
    orchestrator = PipelineOrchestrator()
    try:
        async for event in orchestrator.run(
            query=query,
            sources=sources,
            max_papers=max_papers,
            sources_explicit=True,
        ):
            yield f"data: {json.dumps(event)}\n\n"
    except Exception as e:
        logger.error(f"Pipeline stream error: {e}")
        yield f"data: {json.dumps({'phase': 'error', 'error': str(e)})}\n\n"
    finally:
        yield "event: done\ndata: {}\n\n"


@router.get("/research/stream")
async def research_stream(
    query: str,
    sources: Optional[str] = "arxiv,pubmed,crossref,europepmc,doaj",
    max_papers: Optional[int] = 30,
    _access: None = Depends(require_public_api_access),
):
    """
    SSE endpoint - streams phase-by-phase research pipeline events.
    Connect with EventSource in the frontend.
    """
    source_list = [s.strip() for s in sources.split(",") if s.strip()]
    max_papers = min(max(5, max_papers), 50)

    return StreamingResponse(
        event_stream(query, source_list, max_papers),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


class ResearchRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)
    sources: Optional[list[str]] = Field(default=None)
    max_papers: Optional[int] = Field(default=30, ge=5, le=50)
    mode: Literal["full", "preview"] = "full"


@router.post("/research/query")
async def research_query(
    request: ResearchRequest,
    _access: None = Depends(require_public_api_access),
):
    """
    Non-streaming research query (collects all SSE events and returns final result).
    """
    orchestrator = PipelineOrchestrator()
    final_result = {}
    async for event in orchestrator.run(
        query=request.query,
        sources=request.sources,
        max_papers=request.max_papers,
        sources_explicit=bool(request.sources),
    ):
        if event.get("phase") == "complete":
            final_result = event
    final_result["mode"] = request.mode
    return final_result
