import logging
import aiohttp
from typing import Dict, List
from src.config.settings import settings
from src.integrations.rate_limit_manager import rate_limit_manager

logger = logging.getLogger(__name__)
BASE_URL = "https://ieeexploreapi.ieee.org/api/v1/search/articles"

class IEEEClient:
    async def search_papers(self, query: str, max_results: int = 15, query_lang: str = "en") -> List[Dict]:
        if not settings.IEEE_API_KEY:
            logger.warning("IEEE API key not configured. Skipping IEEE fetch.")
            return []

        async def _fetch():
            params = {
                "apikey": settings.IEEE_API_KEY,
                "querytext": query,
                "max_records": str(max_results),
                "sort_field": "relevance",
                "sort_order": "desc"
            }
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(BASE_URL, params=params) as resp:
                    if resp.status != 200:
                        raise Exception(f"IEEE HTTP {resp.status}")
                    data = await resp.json()
                    return self._parse_data(data)

        # Wrap in your existing circuit breaker / retry manager
        return await rate_limit_manager.execute_with_retry('ieee', _fetch)

    def _parse_data(self, data: Dict) -> List[Dict]:
        papers = []
        articles = data.get("articles", [])
        
        for item in articles:
            # Skip if no abstract (ValidationAgent will drop it anyway, but good to filter early)
            abstract = item.get("abstract", "").strip()
            if not abstract:
                continue
                
            # Extract authors
            authors_list = item.get("authors", {}).get("authors", [])
            author_names = [a.get("full_name", "") for a in authors_list if a.get("full_name")]
            
            doi = item.get("doi", "").strip()
            paper_url = item.get("pdf_url", item.get("html_url", ""))
            
            # Format publication date
            pub_year = item.get("publication_year", "")
            pub_date = f"{pub_year}-01-01" if pub_year else "2000-01-01"

            papers.append({
                "source": "ieee",
                "title": item.get("title", "").strip(),
                "abstract": abstract,
                "authors": ", ".join(author_names) or "Unknown",
                "paper_url": paper_url,
                "doi": doi,
                "published_date": pub_date,
                "language": "en" # IEEE content is predominantly English
            })
            
        return papers

ieee_client = IEEEClient()
