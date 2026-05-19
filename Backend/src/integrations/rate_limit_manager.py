"""
Per-source Rate Limit Manager with exponential backoff + per-source concurrency semaphores.

Key fix: Added asyncio.Semaphore per source to cap simultaneous requests.
  - PubMed: 3 concurrent max (free tier = 3 req/sec)
  - ArXiv:  5 concurrent max
  - Crossref/EuropePMC/DOAJ: 10 concurrent max (generous APIs)
"""
import asyncio
import logging
import time
from typing import Callable, Dict

logger = logging.getLogger(__name__)

# ── Per-source concurrency caps ───────────────────────────────────────────────
# These prevent firing all 9 language variants simultaneously at rate-limited APIs.
SOURCE_CONCURRENCY: Dict[str, int] = {
    "arxiv":     5,
    "pubmed":    3,   # Free tier: 3 req/sec; use API key to raise to 10
    "crossref":  10,
    "europepmc": 8,
    "doaj":      8,
    "ieee":      5,
}

# Minimum seconds between consecutive requests to same source
SOURCE_MIN_INTERVAL: Dict[str, float] = {
    "arxiv":     0.3,
    "pubmed":    0.34,  # ~3 req/sec ceiling
    "crossref":  0.5,
    "europepmc": 0.3,
    "doaj":      0.3,
    "ieee":      0.3,
}


class RateLimitManager:
    """Manages per-source rate limiting with concurrency caps and retry backoff."""

    def __init__(self, max_retries: int = 3, base_delay: float = 2.0):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self._last_call: Dict[str, float] = {}

        # Per-source semaphores — created lazily to avoid event loop issues
        self._semaphores: Dict[str, asyncio.Semaphore] = {}

    def _get_semaphore(self, source: str) -> asyncio.Semaphore:
        """Lazily create per-source semaphore (must be created inside running loop)."""
        if source not in self._semaphores:
            limit = SOURCE_CONCURRENCY.get(source, 5)
            self._semaphores[source] = asyncio.Semaphore(limit)
        return self._semaphores[source]

    async def wait(self, source: str):
        """Enforce minimum interval between requests to the same source."""
        interval = SOURCE_MIN_INTERVAL.get(source, 0.5)
        last = self._last_call.get(source, 0.0)
        elapsed = time.monotonic() - last
        if elapsed < interval:
            await asyncio.sleep(interval - elapsed)
        self._last_call[source] = time.monotonic()

    async def execute_with_retry(self, source: str, coro_fn: Callable):
        """
        Execute a coroutine-returning callable with:
          1. Per-source concurrency semaphore (prevents simultaneous flood)
          2. Per-source minimum interval (rate floor)
          3. Exponential backoff on 429 / rate-limit errors
        """
        semaphore = self._get_semaphore(source)

        async with semaphore:
            for attempt in range(self.max_retries + 1):
                try:
                    await self.wait(source)
                    return await coro_fn()

                except Exception as e:
                    err_str = str(e).lower()
                    is_rate_limit = (
                        "429" in err_str
                        or "rate" in err_str
                        or "too many" in err_str
                        or "quota" in err_str
                    )

                    if is_rate_limit:
                        if attempt == self.max_retries:
                            logger.error(
                                f"[{source}] exhausted {self.max_retries} retries — skipping"
                            )
                            return []
                        delay = self.base_delay * (2 ** attempt)
                        logger.warning(
                            f"[{source}] rate limited, retry {attempt + 1}/{self.max_retries} "
                            f"in {delay:.1f}s"
                        )
                        await asyncio.sleep(delay)

                    else:
                        logger.error(f"[{source}] non-retryable error: {e}")
                        return []

        return []


rate_limit_manager = RateLimitManager()
