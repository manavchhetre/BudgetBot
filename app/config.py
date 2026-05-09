import logging
from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("jerry")


class Settings(BaseSettings):
    debug: bool = False

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "budget_bot"
    session_secret: str = "change-me-in-production"
    app_timezone: str = "Asia/Kolkata"
    web_search_enabled: bool = True

    allowed_origins: str = ""
    sentry_dsn: str = ""

    llm_provider: str = "openai"
    llm_fallback_providers: str = ""

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    groq_api_key: str = ""
    groq_model: str = "llama3-8b-8192"

    google_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    sarvam_api_key: str = ""
    sarvam_model: str = "sarvam-30b"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: Any) -> Any:
        if isinstance(value, str) and value.strip().lower() in {"release", "prod", "production"}:
            return False
        return value

    @property
    def fallback_provider_names(self) -> list[str]:
        return [
            provider.strip().lower()
            for provider in self.llm_fallback_providers.split(",")
            if provider.strip()
        ]

    @property
    def allowed_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.allowed_origins.split(",")
            if origin.strip()
        ]

    def validate_for_production(self) -> None:
        """Log warnings for insecure defaults. Called at startup."""
        if self.session_secret == "change-me-in-production":
            if self.debug:
                logger.warning("Using default SESSION_SECRET — acceptable for local dev only")
            else:
                logger.critical(
                    "SESSION_SECRET is still the default value! "
                    "Set a strong random secret: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
                )


@lru_cache
def get_settings() -> Settings:
    return Settings()
