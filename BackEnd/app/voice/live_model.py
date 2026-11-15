"""GPT-Live with the few session settings Pydantic AI does not expose.

`OpenAILiveModel` builds the session config from a fixed set of settings. We need two more: the delay before Live
acknowledges a delegation by itself (so a fast backend stays silent and a slow one is not met with dead air) and a
designed custom voice, whose id goes in `audio.output.voice` as `{"id": ...}`.
"""

from typing import Any

from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.realtime.openai_live import OpenAILiveModel

#: Live takes at most 500 tokens per append; Vietnamese runs about 3 characters a token with diacritics.
MAX_APPEND_CHARS = 1200


class SosnowLiveModel(OpenAILiveModel):
    def __init__(
        self,
        model: str,
        *,
        api_key: str,
        voice_id: str = "",
        acknowledgement_delay_ms: int | None = None,
    ) -> None:
        super().__init__(model, provider=OpenAIProvider(api_key=api_key))
        self._voice_id = voice_id
        self._ack_delay = acknowledgement_delay_ms

    def _session_config(self, **kwargs: Any) -> dict[str, Any]:
        config = super()._session_config(**kwargs)
        if self._ack_delay is not None:
            config["delegation"]["acknowledgement_delay_ms"] = self._ack_delay
        if self._voice_id:
            config.setdefault("audio", {}).setdefault("output", {})["voice"] = {"id": self._voice_id}
        return config
