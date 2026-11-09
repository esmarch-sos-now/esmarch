"""Application settings. Environment variable names follow the legacy Spring Boot backend."""

from functools import lru_cache
from typing import Literal

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

    # Realtime voice assistant: GPT-Live straight from OpenAI. It speaks; a cheaper backend model does the thinking
    # and runs the tools. Disabled while the key is empty.
    openai_api_key: str = ""
    voice_live_model: str = "gpt-live-1"
    voice_live_backend: str = "gpt-6-luna"
    voice_live_voice: str = "marin"
    voice_live_voice_id: str = ""  # a designed custom voice (see scripts/create_voice.py); replaces `voice_live_voice`
    voice_live_turn_silence_ms: int = Field(default=800, ge=300, le=5000)
    voice_ack_delay_ms: int = Field(default=500, ge=0, le=800)  # wait before Live acknowledges a slow backend itself
    voice_checkin_seconds: float = Field(default=20, ge=0)  # silence while guiding before a check-in; 0 turns them off
    voice_checkin_max: int = Field(default=3, ge=0)  # unanswered check-ins before it stops
    voice_reasoning_effort: Literal["minimal", "low", "medium", "high", "xhigh"] = "low"
    voice_max_sessions: int = 5  # concurrent calls; each one holds a paid upstream connection
    voice_session_seconds: float = 600
    voice_connects_per_window: int = 6  # per IP, over public_api_rate_limit_window_seconds

    @model_validator(mode="after")
    def _validate(self) -> Settings:
        if not self.origins or any("*" in origin for origin in self.origins):
            raise ValueError("Configure explicit frontend origins in CORS_ORIGINS.")
        return self

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def voice_configured(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def admin_configured(self) -> bool:
        return len(self.support_admin_token) >= 32


@lru_cache
def get_settings() -> Settings:
    return Settings()
