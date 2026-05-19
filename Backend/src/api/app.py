"""FastAPI application factory and core endpoints."""
import asyncio
import logging
import os
import sys
import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.cache.redis_cache import redis_cache
from src.config.settings import settings
from src.core.embeddings import embedding_generator
from src.database.cleanup_manager import cleanup_manager
from src.database.supabase_client import supabase_client

os.makedirs(settings.APP_LOG_DIR, exist_ok=True)

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)

root_logger = logging.getLogger()
root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s - %(message)s")

stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setFormatter(formatter)
root_logger.addHandler(stream_handler)

try:
    file_handler = logging.FileHandler(
        os.path.join(settings.APP_LOG_DIR, "backend.log"), "a", "utf-8"
    )
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)
except OSError:
    root_logger.warning("File logging is unavailable; continuing with stdout only.")

logger = logging.getLogger(__name__)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("hpack").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting PolyResearch v%s", settings.VERSION)

    try:
        await asyncio.wait_for(supabase_client.init_database(), timeout=15.0)
        logger.info("Supabase connected")
    except Exception as exc:
        logger.warning("Supabase initialization deferred: %s", exc)

    try:
        await asyncio.wait_for(redis_cache.connect(), timeout=5.0)
        logger.info("Redis connected")
    except Exception as exc:
        logger.warning("Redis initialization deferred: %s", exc)

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None, lambda: embedding_generator.generate_embedding("warmup")
        )
        logger.info("Embedding model warmed")
    except Exception as exc:
        logger.warning("Embedding warmup failed: %s", exc)

    if settings.AUTO_CLEANUP_ENABLED:
        try:
            await asyncio.wait_for(cleanup_manager.start(), timeout=5.0)
        except Exception as exc:
            logger.warning("Cleanup scheduler did not start: %s", exc)

    logger.info("PolyResearch API ready")
    yield

    logger.info("Shutting down PolyResearch API")
    if cleanup_manager.is_running:
        await cleanup_manager.stop()
    await redis_cache.close()
    logger.info("Shutdown complete")


app = FastAPI(
    title="PolyResearch API",
    description="Multilingual research discovery pipeline API",
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.ENABLE_API_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_API_DOCS else None,
    openapi_url="/openapi.json" if settings.ENABLE_API_DOCS else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Admin-Token"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    # The API should not be embedded or granted browser capabilities by default.
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    return response


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed_ms = (time.time() - start) * 1000
    logger.info(
        "%s %s -> %s (%.0fms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


from src.api.routes import admin, chat, papers, research  # noqa: E402

app.include_router(research.router, prefix="/api")
app.include_router(papers.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/")
async def root():
    payload = {
        "name": "PolyResearch API",
        "version": settings.VERSION,
        "status": "operational",
        "pipeline": "agentic multilingual research discovery",
    }
    if settings.ENABLE_API_DOCS:
        payload["docs"] = "/docs"
    return payload


@app.get("/api/health")
async def health():
    try:
        stats = await asyncio.wait_for(
            supabase_client.get_database_stats(), timeout=3.0
        )
        return {
            "status": "healthy",
            "db_papers": stats.get("total_papers", 0),
            "version": settings.VERSION,
        }
    except Exception as exc:
        return {"status": "degraded", "error": str(exc)}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error."},
    )
