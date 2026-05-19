"""Authentication and rate-limit guards for API endpoints."""
import hashlib
import time
from collections import defaultdict, deque
from hmac import compare_digest

from fastapi import Header, HTTPException, Query, Request, status

from src.cache.redis_cache import redis_cache
from src.config.settings import settings

_rate_buckets: dict[str, deque[float]] = defaultdict(deque)
_WINDOW_SECONDS = 60


def _client_key(request: Request) -> str:
    """Return a stable rate-limit key for the caller.

    Only trust X-Forwarded-For when the app sits behind a reverse proxy that
    overwrites that header. In local Docker and direct development, the socket
    address is the safer fallback.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and settings.is_production:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


def _hash_value(raw_value: str) -> str:
    return hashlib.sha256(raw_value.encode("utf-8")).hexdigest()


def _rate_key(raw_key: str) -> str:
    return f"polyresearch:ratelimit:{_hash_value(raw_key)}"


def _secure_equals(supplied: str, expected: str) -> bool:
    """Compare secrets without timing leaks and without Unicode surprises."""
    return compare_digest(
        supplied.encode("utf-8", "surrogatepass"),
        expected.encode("utf-8", "surrogatepass"),
    )


def _extract_api_key(
    authorization: str | None,
    x_api_key: str | None,
    api_key: str | None,
) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    if x_api_key:
        return x_api_key.strip()
    if api_key and settings.ALLOW_QUERY_STRING_API_KEY:
        return api_key.strip()
    return None


def _validate_key_strength(name: str, value: str) -> None:
    if len(value) < settings.MIN_API_KEY_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{name} is configured with an unsafe key length.",
        )


def _validate_public_key(
    authorization: str | None,
    x_api_key: str | None,
    api_key: str | None,
) -> str:
    expected = settings.PUBLIC_API_KEY

    # Fail closed: expensive LLM/search endpoints must never become public just
    # because production configuration forgot to set PUBLIC_API_KEY.
    if settings.REQUIRE_PUBLIC_API_KEY and not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Public API access is not configured.",
        )

    if not expected:
        return "anonymous-development"

    _validate_key_strength("PUBLIC_API_KEY", expected)
    supplied = _extract_api_key(authorization, x_api_key, api_key)
    if not supplied or not _secure_equals(supplied, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid API access token required.",
        )
    return _hash_value(supplied)[:16]


async def _enforce_rate_limit(request: Request, token_fingerprint: str) -> None:
    limit = max(1, settings.PUBLIC_API_RATE_LIMIT_PER_MINUTE)
    client = _client_key(request)
    route = request.scope.get("route")
    route_path = getattr(route, "path", request.url.path)
    key = _rate_key(f"{client}:{token_fingerprint}:{route_path}")

    # Redis makes limits consistent across workers and containers. The in-memory
    # fallback exists for local development; production should alert if Redis is
    # unavailable because each worker would otherwise enforce its own counter.
    count = await redis_cache.increment_with_ttl(key, _WINDOW_SECONDS)
    if count is not None:
        if count > limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Try again in a minute.",
            )
        return

    now = time.monotonic()
    bucket = _rate_buckets[key]
    while bucket and now - bucket[0] > _WINDOW_SECONDS:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Try again in a minute.",
        )
    bucket.append(now)


async def require_public_api_access(
    request: Request,
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
    api_key: str | None = Query(default=None),
) -> None:
    """Require configured API access and enforce per-client rate limiting."""
    token_fingerprint = _validate_public_key(authorization, x_api_key, api_key)
    await _enforce_rate_limit(request, token_fingerprint)


async def require_admin_api_access(
    x_admin_token: str | None = Header(default=None),
) -> None:
    """Protect maintenance endpoints with a separate high-privilege token."""
    expected = settings.ADMIN_API_KEY
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API access is not configured.",
        )

    _validate_key_strength("ADMIN_API_KEY", expected)
    if not x_admin_token or not _secure_equals(x_admin_token.strip(), expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token.",
        )
