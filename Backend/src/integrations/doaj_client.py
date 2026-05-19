"""
DOAJ (Directory of Open Access Journals) REST API Client — multilingual-aware.
DOAJ natively indexes articles in all languages; bibjson carries a 'language' list.
"""
import logging
import urllib.parse
from typing import Dict, List

import aiohttp
from langdetect import detect

from src.integrations.rate_limit_manager import rate_limit_manager

logger = logging.getLogger(__name__)
BASE = "https://doaj.org/api/search/articles/"

# DOAJ stores languages as full English names: "French", "German", etc.
DOAJ_LANG_MAP = {
    "english": "en", "french": "fr", "german": "de", "spanish": "es",
    "chinese": "zh", "japanese": "ja", "portuguese": "pt", "arabic": "ar",
    "russian": "ru", "italian": "it", "dutch": "nl", "korean": "ko",
    "turkish": "tr", "polish": "pl", "swedish": "sv",
}


def _detect_lang(text: str) -> str:
    try:
        return detect(text)
    except Exception:
        return "en"


class DOAJClient:
    async def search_papers(self, query: str, max_results: int = 15) -> List[Dict]:
        async def fetch():
            url = f"{BASE}{urllib.parse.quote(query)}"
            params = {"pageSize": max_results}
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, params=params) as resp:
                    if resp.status != 200:
                        raise Exception(f"HTTP {resp.status}")
                    data = await resp.json()
                    return self._parse(data, _detect_lang(query))

        return await rate_limit_manager.execute_with_retry("doaj", fetch)

    def _parse(self, data: Dict, query_lang: str = "en") -> List[Dict]:
        results = data.get("results", [])
        papers = []
        for item in results:
            try:
                bib = item.get("bibjson") or {}
                title = bib.get("title") or ""
                abstract = bib.get("abstract") or ""
                year = bib.get("year") or 2020
                authors = bib.get("author") or []
                author_names = [a.get("name", "") for a in authors]

                # DOI extraction
                doi_list = bib.get("identifier") or []
                doi = next(
                    (d.get("id") for d in doi_list if d.get("type") == "doi"),
                    "",
                )

                # ── Language detection (3-tier) ──────────────────────────────
                # Tier 1: DOAJ bibjson 'journal.language' list (most reliable)
                journal_langs = (bib.get("journal") or {}).get("language") or []
                if journal_langs:
                    raw = journal_langs[0].lower()
                    lang = DOAJ_LANG_MAP.get(raw, raw[:2])
                # Tier 2: bibjson top-level 'language' (article-level)
                elif bib.get("language"):
                    raw = bib["language"].lower()
                    lang = DOAJ_LANG_MAP.get(raw, raw[:2])
                # Tier 3: detect from title + abstract text
                elif abstract or title:
                    lang = _detect_lang(f"{title} {abstract}")
                else:
                    lang = query_lang

                # DOAJ article URL
                links = bib.get("link") or []
                paper_url = next(
                    (lk.get("url", "") for lk in links if lk.get("type") == "fulltext"),
                    "",
                )

                if not title.strip():
                    continue

                papers.append({
                    "paper_id": f"doaj:{doi or title[:40]}",
                    "source": "doaj",
                    "title": title.strip(),
                    "abstract": abstract.strip(),
                    "authors": ", ".join(author_names) or "Unknown",
                    "paper_url": paper_url,
                    "published_date": f"{year}-01-01",
                    "doi": doi,
                    "citation_ids": [],
                    "language": lang,                 # ← multilingual tag
                })
            except Exception as e:
                logger.debug(f"DOAJ parse error: {e}")
        return papers


doaj_client = DOAJClient()
