"""Application settings loaded from environment variables.

The backend intentionally validates security-sensitive configuration at start
time. A missing production key should stop the service from booting instead of
quietly exposing expensive research and LLM endpoints.
"""
import multiprocessing
from typing import Optional

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    # App
    APP_ENV: str = "production"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    APP_LOG_DIR: str = "/app/logs"
    VERSION: str = "3.0.0"
    CORS_ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    ENABLE_API_DOCS: bool = False

    # API access control
    ADMIN_API_KEY: Optional[str] = None
    PUBLIC_API_KEY: Optional[str] = None
    PUBLIC_API_RATE_LIMIT_PER_MINUTE: int = 6
    REQUIRE_PUBLIC_API_KEY: bool = True
    ALLOW_QUERY_STRING_API_KEY: bool = False
    MIN_API_KEY_LENGTH: int = 32

    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_KEY: str

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50
    CACHE_TTL: int = 3600
    REDIS_SEMANTIC_CACHE_THRESHOLD: float = 0.90

    # LLM providers
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    HF_TOKEN: Optional[str] = None
    HF_MODEL_REPO: Optional[str] = None
    IEEE_API_KEY: Optional[str] = None

    # Pipeline budget and quality controls
    LLM_ANALYSIS_LIMIT: int = 15
    MAX_PAPERS_PER_SEARCH: int = 30
    MAX_PAPER_AGE_YEARS: int = 10
    MIN_ABSTRACT_WORDS: int = 30
    RELATIONSHIP_SIMILARITY_THRESHOLD: float = 0.5
    RELATIONSHIP_MAX_PER_PAPER: int = 5

    # LLM concurrency and pacing
    GEMINI_CONCURRENCY: int = 3
    GEMINI_INTER_BATCH_SLEEP: float = 4.0
    GROQ_CONCURRENCY: int = 2
    GROQ_INTER_BATCH_SLEEP: float = 12.0
    OPENROUTER_CONCURRENCY: int = 2

    # Embeddings
    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    EMBEDDING_DIMENSION: int = 384
    EMBEDDING_DEVICE: str = "cpu"

    # Cleanup and training data
    TRAINING_DATA_DIR: str = "/app/training_data"
    MIN_QUALITY_FOR_TRAINING: float = 0.4
    TRAINING_READY_THRESHOLD: int = 300
    AUTO_CLEANUP_ENABLED: bool = True
    CLEANUP_DAYS_OLD: int = 30
    MAX_PAPERS_LIMIT: int = 8000
    CLEANUP_SCHEDULE_HOUR: int = 3

    # Runtime sizing
    MAX_WORKERS: int = multiprocessing.cpu_count()
    THREAD_POOL_SIZE: int = multiprocessing.cpu_count() * 2

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() in {"prod", "production"}

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.CORS_ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]

    @field_validator("APP_ENV", "LOG_LEVEL")
    @classmethod
    def normalize_text_settings(cls, value: str) -> str:
        return value.strip()

    @field_validator(
        "ADMIN_API_KEY",
        "PUBLIC_API_KEY",
        "SUPABASE_URL",
        "SUPABASE_KEY",
        "SUPABASE_SERVICE_KEY",
        "GEMINI_API_KEY",
        "GROQ_API_KEY",
        "OPENROUTER_API_KEY",
        "HF_TOKEN",
        "HF_MODEL_REPO",
        "IEEE_API_KEY",
        mode="before",
    )
    @classmethod
    def blank_strings_are_missing(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @model_validator(mode="after")
    def validate_security_posture(self) -> "Settings":
        if self.MIN_API_KEY_LENGTH < 16:
            raise ValueError("MIN_API_KEY_LENGTH must be at least 16.")

        if self.is_production and "*" in self.cors_origins:
            raise ValueError("Wildcard CORS origins are not allowed in production.")

        if self.REQUIRE_PUBLIC_API_KEY:
            self._require_secret("PUBLIC_API_KEY", self.PUBLIC_API_KEY)
        elif self.PUBLIC_API_KEY:
            self._require_secret("PUBLIC_API_KEY", self.PUBLIC_API_KEY)

        if self.is_production:
            self._require_secret("ADMIN_API_KEY", self.ADMIN_API_KEY)
        elif self.ADMIN_API_KEY:
            self._require_secret("ADMIN_API_KEY", self.ADMIN_API_KEY)

        if self.is_production and self.ALLOW_QUERY_STRING_API_KEY:
            raise ValueError(
                "ALLOW_QUERY_STRING_API_KEY must stay false in production; query "
                "strings are commonly logged by proxies and browsers."
            )

        return self

    def _require_secret(self, name: str, value: str | None) -> None:
        if not value:
            raise ValueError(f"{name} is required.")
        if len(value) < self.MIN_API_KEY_LENGTH:
            raise ValueError(
                f"{name} must be at least {self.MIN_API_KEY_LENGTH} characters."
            )
        weak_values = {
            "changeme",
            "change-me",
            "replace-me",
            "replace-with-random-public-api-key",
            "replace-with-random-admin-api-key",
        }
        if value.lower() in weak_values:
            raise ValueError(f"{name} must be replaced with a real random value.")


settings = Settings()
