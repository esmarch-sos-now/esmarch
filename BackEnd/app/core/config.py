"""Application settings. Environment variable names follow the legacy Spring Boot backend."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str) -> str:
    """Accept the `postgres://` and `postgresql://` URLs Supabase and Vercel hand out; the app uses psycopg 3."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url.removeprefix(prefix)
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

    database_url: str = "postgresql+psycopg://esmarch:esmarch@localhost:5432/esmarch"

    cors_origins: str = Field(default="http://localhost:3000", validation_alias="CORS_ORIGINS")
    require_https: bool = False

    facilities_data_file: str = "data/seeds/facilities.json"
    guides_data_file: str = "data/seeds/guides.json"  # optional; reviewed content only
    aeds_data_file: str = "data/seeds/aeds.json"  # optional; verified devices only
    # Lesson quizzes are generated from this spreadsheet (a copy of the team's "Dữ liệu.xlsx"; re-read when it changes).
    course_question_bank_file: str = "data/courses/question-bank.xlsx"
    # Signs lesson quiz tokens and seeds their questions. Empty = SUPABASE_SERVICE_KEY (also server-only).
    course_quiz_secret: str = ""
    support_admin_token: str = ""
    # "Tìm kiếm người hỗ trợ": default search radius, demo self-enrolment of signed-in users as responders (no admin
    # verification; never enable in production) and request photos (private object storage until it ends).
    support_radius_meters: int = Field(default=3000, ge=100, le=50_000)
    support_demo_self_enroll: bool = False
    support_max_photos: int = Field(default=3, ge=0, le=10)
    support_photo_max_bytes: int = Field(default=4_000_000, ge=10_000)  # < 4.5 MB serverless body limit
    # One scene video per request. With Supabase Storage the browser uploads it directly (signed upload URL), so this
    # can exceed the serverless body limit; the backend-upload fallback (local dev) is capped by the proxy instead.
    support_video_max_bytes: int = Field(default=25 * 1024 * 1024, ge=10_000)

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
    voice_max_sessions: int = 5  # concurrent calls; each one is a paid OpenAI session
    voice_session_seconds: float = 600
    voice_end_warning_seconds: float = Field(default=60, ge=0)  # warn the caller this long before the limit; 0 = off
    voice_connects_per_window: int = 6  # new calls per IP, over public_api_rate_limit_window_seconds
    voice_heartbeat_seconds: float = Field(default=15, ge=5)  # the browser says it is still there this often ...
    voice_stale_seconds: float = Field(default=60, ge=20)  # ... and a call silent this long is hung up by the reaper
    voice_handoff_end_seconds: float = Field(default=45, ge=10)  # hard end after the hand-over, whatever the browser
    voice_max_tool_posts: int = Field(default=150, ge=1)  # per call: each one starts a paid backend response
    voice_max_nudges: int = Field(default=40, ge=1)  # per call

    # Scheduler secret for GET /api/voice/reap (Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`).
    cron_secret: str = ""
    # Header carrying the caller's IP, set by a proxy you trust (the frontend proxy sends `x-sosnow-client-ip`).
    # Empty = the TCP peer. Only set it when the backend is reachable through that proxy alone.
    client_ip_header: str = ""

    # Accounts live in Supabase Auth. The backend verifies Supabase access tokens against the project's public signing
    # keys (JWKS); no secret is needed. Signed-in endpoints answer 503 while this is empty.
    supabase_url: str = ""  # https://<project-ref>.supabase.co
    # Service key (server only): private bucket for request photos and Realtime broadcast signals.
    supabase_service_key: str = ""
    supabase_photo_bucket: str = "support-photos"

    @model_validator(mode="after")
    def _validate(self) -> Settings:
        self.database_url = normalize_database_url(self.database_url)
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
    def realtime_configured(self) -> bool:
        """Supabase Realtime signals can be sent (otherwise clients poll)."""
        return bool(self.supabase_url and self.supabase_service_key)

    @property
    def course_quiz_key(self) -> str:
        return self.course_quiz_secret or self.supabase_service_key

    @property
    def auth_configured(self) -> bool:
        return bool(self.supabase_url)

    @property
    def supabase_issuer(self) -> str:
        """The `iss` claim of this project's access tokens."""
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def supabase_jwks_url(self) -> str:
        return f"{self.supabase_issuer}/.well-known/jwks.json"

    @property
    def admin_configured(self) -> bool:
        return len(self.support_admin_token) >= 32


@lru_cache
def get_settings() -> Settings:
    return Settings()
