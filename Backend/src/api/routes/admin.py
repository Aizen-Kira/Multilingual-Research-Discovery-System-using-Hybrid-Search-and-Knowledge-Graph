"""Admin routes: cleanup, training data export."""
import logging
import os
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.api.security import require_admin_api_access
from src.database.cleanup_manager import cleanup_manager
from src.config.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin"])


class CleanupRequest(BaseModel):
    days_old: int = Field(default=30, ge=7, le=365)


@router.post("/cleanup", dependencies=[Depends(require_admin_api_access)])
async def trigger_cleanup(request: CleanupRequest):
    result = await cleanup_manager.trigger_manual_cleanup(request.days_old)
    return result


@router.get("/training-data/stats", dependencies=[Depends(require_admin_api_access)])
async def training_stats():
    stats = {}
    total = 0
    for fname in ["gemini.jsonl", "groq.jsonl"]:
        path = os.path.join(settings.TRAINING_DATA_DIR, fname)
        count = 0
        if os.path.exists(path):
            with open(path) as f:
                count = sum(1 for _ in f)
        stats[fname] = count
        total += count
    return {
        "total_samples": total,
        "breakdown": stats,
        "ready_to_train": total >= settings.TRAINING_READY_THRESHOLD,
        "threshold": settings.TRAINING_READY_THRESHOLD,
    }


@router.get("/training-data/export", dependencies=[Depends(require_admin_api_access)])
async def export_training_data(source: str = "gemini"):
    if source not in ("gemini", "groq"):
        raise HTTPException(400, "source must be 'gemini' or 'groq'")
    path = os.path.join(settings.TRAINING_DATA_DIR, f"{source}.jsonl")
    if not os.path.exists(path):
        return {"success": False, "error": "No training data yet"}
    lines = []
    with open(path) as f:
        for line in f:
            try:
                lines.append(json.loads(line))
            except Exception:
                pass
    return {"success": True, "count": len(lines), "data": lines}
