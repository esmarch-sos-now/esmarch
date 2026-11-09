"""Application settings. Environment variable names follow the legacy Spring Boot backend."""

from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

    database_url: str = "postgresql+psycopg://esmarch:esmarch@localhost:5432/esmarch"

    cors_origins: str = Field(default="http://localhost:3000", validation_alias="CORS_ORIGINS")
    require_https: bool = False

    facilities_data_file: str = "data/seeds/facilities.json"
    guides_data_file: str = "data/seeds/guides.json"  # optional; reviewed content only
    aeds_data_file: str = "data/seeds/aeds.json"  # optional; verified devices only
    support_admin_token: str = ""

    public_api_rate_limit_requests: int = 60
    public_api_rate_limit_window_seconds: float = 60
    public_api_max_clients: int = 10_000

    @model_validator(mode="after")
    def _validate(self) -> Settings:
        if not self.origins or any("*" in origin for origin in self.origins):
            raise ValueError("Configure explicit frontend origins in CORS_ORIGINS.")
        return self

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def admin_configured(self) -> bool:
        return len(self.support_admin_token) >= 32


@lru_cache
def get_settings() -> Settings:
    return Settings()
