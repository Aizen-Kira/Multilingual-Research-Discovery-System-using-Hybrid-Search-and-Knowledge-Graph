"""
Supabase Client v3.0
Full implementation with batch_title_lookup, update_last_accessed,
connection pooling, circuit breaker.
"""
import logging
import threading
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import asyncio

from supabase import create_client, Client
from src.config.settings import settings

logger = logging.getLogger(__name__)


class CircuitBreaker:
    def __init__(self, threshold=5, timeout=60.0):
        self.threshold = threshold
        self.timeout = timeout
        self.failures = 0
        self.last_failure = None
        self.is_open = False
        self._lock = threading.Lock()

    def record_success(self):
        with self._lock:
            self.failures = 0
            self.is_open = False

    def record_failure(self):
        with self._lock:
            self.failures += 1
            self.last_failure = time.time()
            if self.failures >= self.threshold:
                self.is_open = True
                logger.warning(f"🔴 Circuit breaker OPEN")

    def can_attempt(self) -> bool:
        with self._lock:
            if not self.is_open:
                return True
            if self.last_failure and (time.time() - self.last_failure) > self.timeout:
                self.failures = 0
                self.is_open = False
                return True
            return False


class SupabaseClient:
    def __init__(self):
        self._client: Optional[Client] = None
        self._initialized = False
        self._lock = threading.Lock()
        self._cb = CircuitBreaker()
        self._sem = asyncio.Semaphore(10)

    async def init_database(self):
        if self._initialized:
            return
        with self._lock:
            if self._initialized:
                return
            try:
                self._client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
                # Simple connectivity test
                self._client.table("research_papers").select("id").limit(1).execute()
                self._initialized = True
                self._cb.record_success()
                logger.info("✅ Supabase connected")
            except Exception as e:
                self._cb.record_failure()
                logger.error(f"Supabase init failed: {e}")
                raise

    async def _exec(self, fn):
        if not self._cb.can_attempt():
            raise RuntimeError("Circuit breaker is OPEN")
        async with self._sem:
            if not self._initialized:
                await self.init_database()
            try:
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, fn)
                self._cb.record_success()
                return result
            except Exception as e:
                self._cb.record_failure()
                raise

    # ── Paper operations ──────────────────────────────────────────────────────
    async def store_paper(self, paper: Dict) -> Optional[int]:
        try:
            data = {
                "title": paper.get("title"),
                "abstract": paper.get("abstract"),
                "authors": paper.get("authors"),
                "source": paper.get("source") or paper.get("_source"),
                "paper_url": paper.get("paper_url"),
                "published_date": paper.get("published_date"),
                "language": paper.get("language", "en"),
                "embedding": paper.get("embedding"),
                "embedding_model": paper.get("embedding_model"),
                "context_summary": paper.get("context_summary"),
                "research_domain": paper.get("research_domain", "General Research"),
                "methodology": paper.get("methodology"),
                "key_findings": paper.get("key_findings", []),
                "innovations": paper.get("innovations", []),
                "limitations": paper.get("limitations", []),
                "contributions": paper.get("contributions", []),
                "quality_score": paper.get("quality_score", 0.5),
                "ai_agent_used": paper.get("ai_agent_used"),
                "analysis_method": paper.get("analysis_method"),
                "last_accessed": datetime.now().isoformat(),
            }
            def _store():
                resp = self._client.table("research_papers").upsert(
                    data, on_conflict="title,source"
                ).execute()
                return resp.data[0]["id"] if resp.data else None
            return await self._exec(_store)
        except Exception as e:
            logger.error(f"store_paper failed: {e}")
            return None
        
    async def get_existing_paper_keys(self) -> dict:
        """
        Fetch all existing DOIs and lowercase titles from Supabase.
        Used by ValidationAgent to skip already-stored papers on every query.
        Returns {"dois": set(), "titles": set()}
        Single query fetches both doi and title columns in one round-trip.
        """
        dois: set = set()
        titles: set = set()
        try:
            def _fetch():
                # ✅ FIX: was `self.client` (missing underscore) → AttributeError at runtime
                resp = self._client.table("research_papers") \
                    .select("doi, title") \
                    .execute()
                return resp.data or []

            rows = await self._exec(_fetch)

            for row in rows:
                if row.get("doi"):
                    dois.add(row["doi"])
                if row.get("title"):
                    titles.add(row["title"].strip().lower())

        except Exception as e:
            # ✅ FIX: was `self.logger` — SupabaseClient uses module-level `logger`
            logger.warning(f"get_existing_paper_keys failed (dedup skipped): {e}")

        return {"dois": dois, "titles": titles}



    async def batch_title_lookup(self, titles: List[str]) -> List[Dict]:
        """Check which titles already exist in DB and return their full analysis."""
        try:
            def _lookup():
                resp = self._client.table("research_papers").select(
                    "id,title,embedding,research_domain,key_findings,methodology,"
                    "context_summary,innovations,limitations,contributions,ai_agent_used,"
                    "quality_score,analysis_method"
                ).in_("title", titles[:100]).execute()
                return resp.data or []
            return await self._exec(_lookup)
        except Exception as e:
            logger.error(f"batch_title_lookup failed: {e}")
            return []

    async def update_last_accessed(self, paper_id: int):
        try:
            def _update():
                self._client.table("research_papers").update(
                    {"last_accessed": datetime.now().isoformat()}
                ).eq("id", paper_id).execute()
            await self._exec(_update)
        except Exception as e:
            logger.warning(f"update_last_accessed failed: {e}")

    async def store_relationship(self, rel: Dict) -> Optional[int]:
        try:
            data = {
                "paper1_id": rel.get("paper1_id"),
                "paper2_id": rel.get("paper2_id"),
                "relationship_type": rel.get("relationship_type", "related"),
                "relationship_strength": rel.get("relationship_strength", 0.5),
                "relationship_context": rel.get("relationship_context"),
                "connection_reasoning": rel.get("connection_reasoning"),
                "analysis_method": rel.get("analysis_method", "cosine_similarity"),
                "confidence_score": rel.get("confidence_score", 0.5),
                "semantic_similarity": rel.get("semantic_similarity", 0.0),
                "is_cross_linguistic": rel.get("is_cross_linguistic", False),
                "language_pair": rel.get("language_pair"),
            }
            def _store():
                resp = self._client.table("paper_relationships").upsert(
                    data, on_conflict="paper1_id,paper2_id"
                ).execute()
                return resp.data[0]["id"] if resp.data else None
            return await self._exec(_store)
        except Exception as e:
            logger.error(f"store_relationship failed: {e}")
            return None

    async def vector_search(self, query_embedding: List[float], limit: int = 10, threshold: float = 0.5) -> List[Dict]:
        try:
            def _search():
                resp = self._client.rpc("match_papers", {
                    "query_embedding": query_embedding,
                    "match_threshold": threshold,
                    "match_count": limit,
                }).execute()
                return resp.data or []
            return await self._exec(_search)
        except Exception as e:
            logger.error(f"vector_search failed: {e}")
            return []

    async def get_paper_by_id(self, paper_id: int) -> Optional[Dict]:
        try:
            def _get():
                resp = self._client.table("research_papers").select("*").eq("id", paper_id).execute()
                return resp.data[0] if resp.data else None
            return await self._exec(_get)
        except Exception as e:
            return None

    async def get_paper_relationships(self, paper_id: int) -> List[Dict]:
        try:
            def _get():
                resp = self._client.table("paper_relationships").select("*").or_(
                    f"paper1_id.eq.{paper_id},paper2_id.eq.{paper_id}"
                ).execute()
                return resp.data or []
            return await self._exec(_get)
        except Exception as e:
            return []

    async def search_papers(self, query: str = None, domain: str = None, limit: int = 50) -> List[Dict]:
        try:
            def _search():
                q = self._client.table("research_papers").select("*")
                if query:
                    q = q.ilike("title", f"%{query}%")
                if domain:
                    q = q.eq("research_domain", domain)
                return q.limit(limit).execute().data or []
            return await self._exec(_search)
        except Exception as e:
            return []

    async def cleanup_old_papers(self, days_old: int = 30) -> int:
        try:
            cutoff = (datetime.now() - timedelta(days=days_old)).isoformat()
            def _cleanup():
                resp = self._client.table("research_papers").select("id").lt("last_accessed", cutoff).execute()
                if not resp.data:
                    return 0
                ids = [r["id"] for r in resp.data]
                self._client.table("research_papers").delete().in_("id", ids).execute()
                return len(ids)
            return await self._exec(_cleanup)
        except Exception as e:
            logger.error(f"cleanup failed: {e}")
            return 0

    async def get_database_stats(self) -> Dict:
        try:
            def _stats():
                total = self._client.table("research_papers").select("id", count="exact").execute().count or 0
                rels = self._client.table("paper_relationships").select("id", count="exact").execute().count or 0
                return {
                    "total_papers": total,
                    "total_relationships": rels,
                    "circuit_breaker_status": "OPEN" if self._cb.is_open else "CLOSED",
                }
            return await self._exec(_stats)
        except Exception as e:
            return {"total_papers": 0, "total_relationships": 0, "error": str(e)}


supabase_client = SupabaseClient()
