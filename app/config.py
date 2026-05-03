from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "budget_bot"
    session_secret: str = "change-me-in-production"
    app_timezone: str = "Asia/Kolkata"
    web_search_enabled: bool = True

    llm_provider: str = "openai"
    llm_fallback_providers: str = ""

    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"

    google_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    sarvam_api_key: str = ""
    sarvam_model: str = "sarvam-30b"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def fallback_provider_names(self) -> list[str]:
        return [
            provider.strip().lower()
            for provider in self.llm_fallback_providers.split(",")
            if provider.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
