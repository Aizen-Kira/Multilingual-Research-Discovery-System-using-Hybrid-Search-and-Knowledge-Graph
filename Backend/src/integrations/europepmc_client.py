"""
Europe PMC REST API Client — multilingual-aware.
EuropePMC natively indexes papers in 30+ languages.
We pass lang: filter param and tag each paper with its language.
"""
import logging
from typing import Dict, List

import aiohttp
from langdetect import detect

from src.integrations.rate_limit_manager import rate_limit_manager

logger = logging.getLogger(__name__)
BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"

# EuropePMC uses ISO 639-1 two-letter codes in its lang field
DETECT_FALLBACK = "en"


def _detect_lang(text: str) -> str:
    try:
        return detect(text)
    except Exception:
        return DETECT_FALLBACK


class EuropePMCClient:
    async def search_papers(self, query: str, max_results: int = 15) -> List[Dict]:
        async def fetch():
            q_lang = _detect_lang(query)

            params = {
                "query": query,
                "resultType": "core",
                "pageSize": max_results,
                "format": "json",
                # EuropePMC supports LANG:"de" style filter appended to query
                # We inject it only for non-English variants to get native papers
            }

            # Append language restriction for non-English queries so we get
            # papers actually written in that language, not just about that topic
            if q_lang != "en":
                params["query"] = f"{query} LANG:\"{q_lang}\""

            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(BASE, params=params) as resp:
                    if resp.status != 200:
                        raise Exception(f"HTTP {resp.status}")
                    data = await resp.json()
                    return self._parse(data, q_lang)

        return await rate_limit_manager.execute_with_retry("europepmc", fetch)

    def _parse(self, data: Dict, query_lang: str = "en") -> List[Dict]:
        results = data.get("resultList", {}).get("result", [])
        papers = []
        for item in results:
            title = item.get("title") or ""
            abstract = item.get("abstractText") or ""
            pmid = item.get("pmid") or ""
            doi = item.get("doi") or ""
            year = item.get("pubYear") or 2020

            # EuropePMC returns a 'language' field (ISO 639-1 or full name)
            api_lang = (item.get("language") or "").lower()
            if api_lang:
                # Normalise: EuropePMC sometimes returns "eng", "fre", "ger"
                EPMC_LANG_MAP = {
                    "eng": "en", "fre": "fr", "ger": "de", "spa": "es",
                    "zho": "zh", "jpn": "ja", "por": "pt", "ara": "ar",
                    "rus": "ru",
                }
                lang = EPMC_LANG_MAP.get(api_lang, api_lang[:2])
            elif abstract:
                lang = _detect_lang(f"{title} {abstract}")
            else:
                lang = query_lang

            if not title.strip():
                continue

            papers.append({
                "paper_id": f"EPMC:{pmid or doi}",
                "source": "europepmc",
                "title": title.strip(),
                "abstract": abstract.strip(),
                "authors": item.get("authorString") or "Unknown",
                "paper_url": (
                    f"https://europepmc.org/article/MED/{pmid}" if pmid else ""
                ),
                "published_date": f"{year}-01-01",
                "doi": doi,
                "citation_ids": [],
                "language": lang,                     # ← multilingual tag
            })
        return papers


europepmc_client = EuropePMCClient()
