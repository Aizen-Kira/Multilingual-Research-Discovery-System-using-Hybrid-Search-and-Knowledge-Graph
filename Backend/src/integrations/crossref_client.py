"""
Crossref REST API Client — multilingual-aware.


Key improvements:
  - Falls back to full-text langdetect when API language field is missing
  - Inherits query language when abstract is too short to detect reliably
  - Safely handles non-ASCII queries (CJK, Arabic, etc.)

FIX: Removed filter=language:<lang> — Crossref API does NOT support this filter param.
     It was causing HTTP 400 for ALL non-English queries (ES, FR, DE, PT).
     Language filtering is handled post-fetch by ValidationAgent (content-based).
"""
import logging
from typing import Dict, List, Optional


import aiohttp
from src.integrations.rate_limit_manager import rate_limit_manager


logger = logging.getLogger(__name__)


BASE = "https://api.crossref.org/works"


# Crossref uses IANA/BCP-47 language codes
LANG_TO_BCP47: Dict[str, str] = {
    "zh": "zh",
    "de": "de",
    "fr": "fr",
    "es": "es",
    "ja": "ja",
    "pt": "pt",
    "ar": "ar",
    "ru": "ru",
    "en": "en",
    "it": "it",
    "ko": "ko",
    "nl": "nl",
    "pl": "pl",
    "tr": "tr",
}


# ── langdetect (optional) ─────────────────────────────────────────────────────
try:
    from langdetect import detect_langs as _detect_langs
    _LANGDETECT_OK = True
except ImportError:
    _LANGDETECT_OK = False



def _detect_lang(text: str, fallback: str = "en") -> str:
    """Detect language with confidence threshold. Returns fallback if uncertain."""
    if not _LANGDETECT_OK or len(text.strip()) < 30:
        return fallback
    try:
        results = _detect_langs(text[:600])
        top = results[0]
        return top.lang if top.prob >= 0.75 else fallback
    except Exception:
        return fallback



class CrossrefClient:


    async def search_papers(
        self,
        query: str,
        max_results: int = 15,
        query_lang: str = "en",
    ) -> List[Dict]:


        async def fetch():
            bcp = LANG_TO_BCP47.get(query_lang.lower(), "")


            # ── Sanitize query: Crossref /works only supports ASCII-safe queries ──
            import unicodedata


            safe_query = (
                unicodedata.normalize("NFKD", query)
                .encode("ascii", "ignore")
                .decode("ascii")
                .strip()
            )


            # If sanitization wipes out the query (pure non-ASCII), skip
            if not safe_query:
                logger.warning(
                    f"Crossref skipped (non-ASCII query wiped out) | "
                    f"original='{query[:40]}' | lang={query_lang}"
                )
                return []


            params: Dict[str, str] = {
                "query": safe_query,
                "rows": str(max_results),
                "select": "DOI,title,abstract,author,published,reference,type,publisher",
            }


            # ✅ FIX: Removed the block below — filter=language:{bcp} is NOT a valid
            #         Crossref API filter parameter. It caused HTTP 400 for every
            #         non-English query (ES, FR, DE, PT, etc.).
            #
            # REMOVED:
            #   if bcp and bcp != "en":
            #       params["filter"] = f"language:{bcp}"


            timeout = aiohttp.ClientTimeout(total=30)


            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(
                    BASE,
                    params=params,
                    headers={"User-Agent": "PolyResearch/3.0 (research aggregator)"},
                ) as resp:


                    # Helpful debugging for malformed queries
                    if resp.status == 400:
                        logger.error(
                            f"Crossref 400 Bad Request | url={resp.url} | "
                            f"query='{safe_query[:40]}' | lang={query_lang} | bcp={bcp}"
                        )
                        raise Exception(f"Crossref HTTP 400 (url={resp.url})")


                    if resp.status != 200:
                        raise Exception(f"Crossref HTTP {resp.status}")


                    data = await resp.json()
                    return self._parse(data, query_lang=query_lang)


        return await rate_limit_manager.execute_with_retry("crossref", fetch)


    def _parse(self, data: Dict, query_lang: str = "en") -> List[Dict]:
        items = data.get("message", {}).get("items", [])
        papers = []


        for item in items:
            title_list = item.get("title") or []
            title = title_list[0] if title_list else ""
            if not title.strip():
                continue


            abstract = (item.get("abstract") or "").strip()
            doi = (item.get("DOI") or "").strip()


            # Published date
            pub = (item.get("published") or {}).get("date-parts", [[2020]])
            year = (pub[0] or [2020])[0] if pub else 2020


            # Authors
            authors_raw = item.get("author") or []
            author_names = [
                f"{a.get('given', '')} {a.get('family', '')}".strip()
                for a in authors_raw
            ]


            # Citation IDs
            refs = item.get("reference") or []
            citation_ids = [r["DOI"] for r in refs if r.get("DOI")]


            # ── Language resolution (priority order) ─────────────────────────
            api_lang = (item.get("language") or "").strip()
            if api_lang:
                lang = api_lang[:2].lower()
            elif abstract:
                lang = _detect_lang(f"{title} {abstract}", fallback=query_lang)
            elif len(title) > 15:
                lang = _detect_lang(title, fallback=query_lang)
            else:
                lang = query_lang


            papers.append({
                "paper_id": f"doi:{doi}" if doi else f"cr:{title[:40]}",
                "source": "crossref",
                "title": title.strip(),
                "abstract": abstract,
                "authors": ", ".join(author_names) or "Unknown",
                "paper_url": f"https://doi.org/{doi}" if doi else "",
                "published_date": f"{year}-01-01",
                "doi": doi,
                "citation_ids": citation_ids,
                "language": lang,
            })


        return papers



# Singleton instance
crossref_client = CrossrefClient()
