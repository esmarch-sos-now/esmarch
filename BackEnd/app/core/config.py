"""Application settings. Environment variable names follow the legacy Spring Boot backend."""

import json
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
    # "Tìm kiếm người hỗ trợ": default search radius, demo self-enrolment of signed-in users as responders (no admin
    # verification; never enable in production), WebSocket limits and request photos (kept in RAM until it ends).
    support_radius_meters: int = Field(default=3000, ge=100, le=50_000)
    support_demo_self_enroll: bool = False
    support_ws_connects_per_window: int = 30  # per IP, over public_api_rate_limit_window_seconds
    support_offline_grace_seconds: float = Field(default=20, ge=0)  # a dropped responder socket stays available
    support_max_photos: int = Field(default=3, ge=0, le=10)
    support_photo_max_bytes: int = Field(default=5 * 1024 * 1024, ge=10_000)
    support_video_max_bytes: int = Field(default=25 * 1024 * 1024, ge=10_000)
    fcm_service_account_json: str = ""

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
    voice_end_warning_seconds: float = Field(default=60, ge=0)  # warn the caller this long before the limit; 0 = off
    voice_resume_grace_seconds: float = Field(default=20, ge=0)  # keep a call whose WebSocket dropped; 0 = no resume
    voice_connects_per_window: int = 6  # per IP, over public_api_rate_limit_window_seconds

    # Accounts. JWT access tokens (HS256) plus opaque rotating refresh tokens. Disabled (503) while the key is short.
    auth_secret_key: str = ""  # >= 32 chars; `openssl rand -hex 32`
    access_token_ttl_seconds: int = Field(default=900, ge=60, le=3600)
    refresh_token_ttl_days: int = Field(default=30, ge=1, le=365)
    # A rotated refresh token presented again within this window gets a fresh sibling instead of revoking the family:
    # the browser may fire parallel requests that all refresh with the same cookie.
    refresh_reuse_grace_seconds: float = Field(default=10, ge=0, le=60)
    otp_ttl_seconds: int = Field(default=600, ge=60, le=3600)
    otp_resend_cooldown_seconds: int = Field(default=60, ge=0, le=600)
    otp_max_attempts: int = Field(default=5, ge=1, le=20)
    login_attempts_per_window: int = Field(default=10, ge=1)  # per email
    login_window_seconds: float = Field(default=900, gt=0)

    # Confirmation codes are mailed through Resend. Without a key, codes are only logged when AUTH_DEV_LOG_CODES is on.
    resend_api_key: str = ""
    resend_from: str = "SOS NOW <onboarding@resend.dev>"
    auth_dev_log_codes: bool = False

    # Phone sign-up and password reset: the browser proves the number with Firebase Phone Auth (SMS OTP) and sends
    # the resulting ID token. Disabled (503) while the project id is empty. The OTP must be at most this old.
    firebase_project_id: str = ""
    phone_otp_max_age_seconds: int = Field(default=600, ge=60, le=3600)

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
    def auth_configured(self) -> bool:
        return len(self.auth_secret_key) >= 32

    @property
    def fcm_configured(self) -> bool:
        try:
            account = json.loads(self.fcm_service_account_json)
        except TypeError, json.JSONDecodeError:
            return False
        required = ("project_id", "client_email", "private_key")
        return isinstance(account, dict) and all(account.get(key) for key in required)

    @property
    def admin_configured(self) -> bool:
        return len(self.support_admin_token) >= 32


@lru_cache
def get_settings() -> Settings:
    return Settings()
