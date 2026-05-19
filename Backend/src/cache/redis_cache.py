"""Redis Cache with semantic scan support."""
import json
import logging
from typing import Any, List, Optional
import redis.asyncio as redis
from src.config.settings import settings

logger = logging.getLogger(__name__)


class RedisCache:
    def __init__(self):
        self._client: Optional[redis.Redis] = None

    async def connect(self):
        if self._client:
            return
        try:
            pool = redis.ConnectionPool.from_url(
                settings.REDIS_URL,
                max_connections=settings.REDIS_MAX_CONNECTIONS,
                decode_responses=True,
            )
            self._client = redis.Redis(connection_pool=pool)
            await self._client.ping()
            logger.info("✅ Redis connected")
        except Exception as e:
            logger.error(f"Redis connect failed: {e}")
            self._client = None

    async def get(self, key: str) -> Optional[Any]:
        try:
            if not self._client:
                return None
            val = await self._client.get(key)
            return json.loads(val) if val else None
        except Exception:
            return None

    async def set(self, key: str, value: Any, ttl: int = None) -> bool:
        try:
            if not self._client:
                return False
            ttl = ttl or settings.CACHE_TTL
            await self._client.setex(key, ttl, json.dumps(value))
            return True
        except Exception:
            return False

    async def scan_keys(self, pattern: str) -> List[str]:
        """Return all keys matching a pattern."""
        try:
            if not self._client:
                return []
            keys = []
            async for key in self._client.scan_iter(match=pattern, count=100):
                keys.append(key)
            return keys
        except Exception:
            return []

    async def delete(self, key: str):
        try:
            if self._client:
                await self._client.delete(key)
        except Exception:
            pass

    async def increment_with_ttl(self, key: str, ttl: int) -> Optional[int]:
        """Atomically increment a counter and set its TTL on first use."""
        try:
            if not self._client:
                return None
            value = await self._client.incr(key)
            if value == 1:
                await self._client.expire(key, ttl)
            return int(value)
        except Exception as e:
            logger.warning(f"Redis rate-limit counter failed: {e}")
            return None

    async def close(self):
        try:
            if self._client:
                await self._client.aclose()
        except Exception:
            pass


redis_cache = RedisCache()
