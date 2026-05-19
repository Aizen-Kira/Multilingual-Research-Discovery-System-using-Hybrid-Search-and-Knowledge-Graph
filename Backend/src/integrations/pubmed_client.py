"""PubMed eUtils Client."""
import asyncio
import logging
from datetime import datetime
from typing import Dict, List
import aiohttp
import xmltodict
from src.integrations.rate_limit_manager import rate_limit_manager

logger = logging.getLogger(__name__)
BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


class PubMedClient:
    async def search_papers(self, query: str, max_results: int = 15) -> List[Dict]:
        ids = await self._search_ids(query, max_results)
        if not ids:
            return []
        return await self._fetch_details(ids)

    async def _search_ids(self, query: str, max_results: int) -> List[str]:
        async def _fetch():
            params = {"db": "pubmed", "term": query, "retmax": max_results, "retmode": "json", "sort": "relevance"}
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(f"{BASE}/esearch.fcgi", params=params) as resp:
                    if resp.status != 200:
                        raise Exception(f"HTTP {resp.status}")
                    data = await resp.json()
                    return data.get("esearchresult", {}).get("idlist", [])
        return await rate_limit_manager.execute_with_retry("pubmed", _fetch)

    async def _fetch_details(self, ids: List[str]) -> List[Dict]:
        async def _fetch():
            params = {"db": "pubmed", "id": ",".join(ids[:50]), "retmode": "xml"}
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(f"{BASE}/efetch.fcgi", params=params) as resp:
                    if resp.status != 200:
                        raise Exception(f"HTTP {resp.status}")
                    xml = await resp.text()
                    return self._parse_xml(xml)
        return await rate_limit_manager.execute_with_retry("pubmed", _fetch)

    def _parse_xml(self, xml: str) -> List[Dict]:
        try:
            data = xmltodict.parse(xml)
            articles = data.get("PubmedArticleSet", {}).get("PubmedArticle", [])
            if isinstance(articles, dict):
                articles = [articles]
            papers = []
            for article in articles:
                try:
                    medline = article.get("MedlineCitation", {})
                    art = medline.get("Article", {})
                    title = art.get("ArticleTitle", "Untitled")
                    if isinstance(title, dict):
                        title = title.get("#text", "Untitled")
                    abstract_data = art.get("Abstract", {}).get("AbstractText", "")
                    if isinstance(abstract_data, list):
                        abstract = " ".join(str(a.get("#text", a) if isinstance(a, dict) else a) for a in abstract_data)
                    elif isinstance(abstract_data, dict):
                        abstract = abstract_data.get("#text", "")
                    else:
                        abstract = str(abstract_data)
                    pmid = medline.get("PMID", {})
                    if isinstance(pmid, dict):
                        pmid = pmid.get("#text", "")
                    pub_date = art.get("Journal", {}).get("JournalIssue", {}).get("PubDate", {})
                    year = pub_date.get("Year", str(datetime.now().year))
                    papers.append({
                        "paper_id": f"PMID{pmid}",
                        "source": "pubmed",
                        "title": str(title).strip(),
                        "abstract": abstract.strip(),
                        "authors": "Unknown",
                        "paper_url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                        "published_date": f"{year}-01-01",
                        "citation_ids": [],
                    })
                except Exception as e:
                    logger.debug(f"PubMed parse error: {e}")
            return papers
        except Exception as e:
            logger.error(f"PubMed XML parse failed: {e}")
            return []


pubmed_client = PubMedClient()
