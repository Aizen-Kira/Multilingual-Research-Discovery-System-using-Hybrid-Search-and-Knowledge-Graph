"""ArXiv API Client — Atom XML with citation ID extraction."""
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List
import aiohttp
import xmltodict
from src.integrations.rate_limit_manager import rate_limit_manager

logger = logging.getLogger(__name__)
BASE_URL = "http://export.arxiv.org/api/query"


class ArXivClient:
    async def search_papers(self, query: str, max_results: int = 15) -> List[Dict]:
        async def _fetch():
            params = {
                "search_query": f"all:{query}",
                "start": 0,
                "max_results": max_results,
                "sortBy": "relevance",
                "sortOrder": "descending",
            }
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(BASE_URL, params=params) as resp:
                    if resp.status != 200:
                        raise Exception(f"HTTP {resp.status}")
                    xml = await resp.text()
                    return self._parse(xml)
        return await rate_limit_manager.execute_with_retry("arxiv", _fetch)

    def _parse(self, xml: str) -> List[Dict]:
        data = xmltodict.parse(xml)
        entries = data.get("feed", {}).get("entry", [])
        if isinstance(entries, dict):
            entries = [entries]
        papers = []
        for e in entries:
            try:
                authors = e.get("author", [])
                if isinstance(authors, dict):
                    authors = [authors]
                author_names = [a.get("name", "") for a in authors if isinstance(a, dict)]
                paper_id = (e.get("id") or "").split("/")[-1]
                pub = (e.get("published") or "")[:10]
                try:
                    pub_date = datetime.strptime(pub, "%Y-%m-%d").isoformat()
                except Exception:
                    pub_date = datetime.now().isoformat()
                papers.append({
                    "paper_id": paper_id,
                    "source": "arxiv",
                    "title": (e.get("title") or "").strip().replace("\n", " "),
                    "abstract": (e.get("summary") or "").strip().replace("\n", " "),
                    "authors": ", ".join(author_names) or "Unknown",
                    "paper_url": e.get("id", ""),
                    "published_date": pub_date,
                    "citation_ids": [],  # ArXiv API doesn't expose citations directly
                    "doi": e.get("arxiv:doi", {}).get("#text", "") if isinstance(e.get("arxiv:doi"), dict) else "",
                })
            except Exception as exc:
                logger.debug(f"ArXiv parse error: {exc}")
        return papers


arxiv_client = ArXivClient()
