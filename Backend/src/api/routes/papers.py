"""Paper search and retrieval routes."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from src.api.security import require_public_api_access
from src.database.supabase_client import supabase_client
from src.core.graph_builder import graph_builder

logger = logging.getLogger(__name__)
router = APIRouter(tags=["papers"])


@router.get("/papers/search")
async def search_papers(
    q: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    _access: None = Depends(require_public_api_access),
):
    papers = await supabase_client.search_papers(query=q, domain=domain, limit=limit)
    return {"success": True, "count": len(papers), "papers": papers}


@router.get("/papers/{paper_id}")
async def get_paper(
    paper_id: int,
    _access: None = Depends(require_public_api_access),
):
    paper = await supabase_client.get_paper_by_id(paper_id)
    if not paper:
        raise HTTPException(404, "Paper not found")
    rels = await supabase_client.get_paper_relationships(paper_id)
    return {"success": True, "paper": paper, "relationships": rels}


@router.get("/stats")
async def get_stats(_access: None = Depends(require_public_api_access)):
    stats = await supabase_client.get_database_stats()
    return stats
