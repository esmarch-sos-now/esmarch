"""State machine of one first-aid call, ported from `demo-voice` (`src/lib/first-aid/call-state.ts`).

Code decides the phase, which tools are allowed and how dangerous signs are handled; the model only
understands what the caller says and picks an action inside what the phase allows. Pure functions, no I/O,
so it is tested on its own.
"""

import time
from dataclasses import dataclass, field, replace
from typing import Literal

from app.voice.guides import FIRST_AID_GUIDES, get_guide, step_lines

CallPhase = Literal["triage", "confirming", "guiding", "monitoring", "handoff"]

PHASE_LABEL: dict[CallPhase, str] = {
    "triage": "Phân loại",
    "confirming": "Xác nhận",
    "guiding": "Đang hướng dẫn",
    "monitoring": "Theo dõi",
    "handoff": "Bàn giao",
}

RED_FLAG_LINE = "Nạn nhân đang rất nguy hiểm. Nếu chưa gọi, bạn gọi cấp cứu 115 ngay."
GUIDE_COMPLETED_LINE = "Bạn đã làm xong các bước. Mình vẫn ở đây, nếu nạn nhân có gì thay đổi thì nói mình biết."
#: Spoken by Live at the start (a commentary append: it may put it in its own words).
GREETING_TEXT = "Dạ, mình là trợ lý sơ cứu SOS NOW. Bạn cho mình biết chuyện gì đang xảy ra với nạn nhân."


@dataclass(frozen=True)
class VictimSigns:
    awake: bool | None = None
    breathing: bool | None = None
    talking: bool | None = None

    def merge(self, update: VictimSigns) -> VictimSigns:
        """Only the fields the caller actually mentioned overwrite what is known."""
        return VictimSigns(
            awake=self.awake if update.awake is None else update.awake,
            breathing=self.breathing if update.breathing is None else update.breathing,
            talking=self.talking if update.talking is None else update.talking,
        )

    @property
    def critical(self) -> bool:
        return self.awake is False or self.breathing is False


@dataclass(frozen=True)
class CallState:
    phase: CallPhase = "triage"
    guide_id: str | None = None
    pending_guide_id: str | None = None
    step_index: int | None = None
    signs: VictimSigns = field(default_factory=VictimSigns)
    red_flag_announced: bool = False
    """115 was already urged for this deterioration (announced once per time things get worse)."""
    completed_guides: tuple[str, ...] = ()
    started_at: float = field(default_factory=time.time)


# ---- events -----------------------------------------------------------------------------------------


@dataclass(frozen=True)
class GuideProposed:
    guide_id: str


@dataclass(frozen=True)
class GuideRejected:
    pass


@dataclass(frozen=True)
class GuideOpened:
    guide_id: str
    step_index: int


@dataclass(frozen=True)
class StepChanged:
    step_index: int


@dataclass(frozen=True)
class GuideCompleted:
    pass


@dataclass(frozen=True)
class SignsUpdated:
    signs: VictimSigns


@dataclass(frozen=True)
class Handoff:
    pass


CallEvent = GuideProposed | GuideRejected | GuideOpened | StepChanged | GuideCompleted | SignsUpdated | Handoff


# ---- effects (what the call must do after a transition) ---------------------------------------------


@dataclass(frozen=True)
class Say:
    text: str


@dataclass(frozen=True)
class ShowStep:
    guide_id: str
    step_index: int


CallEffect = Say | ShowStep


def reduce_call(state: CallState, event: CallEvent, now: float | None = None) -> tuple[CallState, list[CallEffect]]:
    match event:
        case GuideProposed(guide_id):
            return replace(state, phase="confirming", pending_guide_id=guide_id), []
        case GuideRejected():
            return replace(state, phase="triage", pending_guide_id=None), []
        case GuideOpened(guide_id, step_index):
            return replace(state, phase="guiding", guide_id=guide_id, pending_guide_id=None, step_index=step_index), []
        case StepChanged(step_index):
            return replace(state, step_index=step_index, phase="guiding" if state.guide_id else state.phase), []
        case GuideCompleted():
            done = state.completed_guides
            if state.guide_id and state.guide_id not in done:
                done = (*done, state.guide_id)
            return replace(state, phase="monitoring", completed_guides=done), [Say(GUIDE_COMPLETED_LINE)]
        case SignsUpdated(update):
            return _signs_updated(state, update)
        case Handoff():
            return replace(state, phase="handoff"), [Say(handoff_summary(state, now))]
    raise AssertionError(event)  # pragma: no cover


def _signs_updated(state: CallState, update: VictimSigns) -> tuple[CallState, list[CallEffect]]:
    signs = state.signs.merge(update)
    nxt = replace(state, signs=signs)
    if not signs.critical:
        return replace(nxt, red_flag_announced=False), []

    effects: list[CallEffect] = []
    if not state.red_flag_announced:
        effects.append(Say(RED_FLAG_LINE))
        nxt = replace(nxt, red_flag_announced=True)

    # Critical before the caller confirmed: open the pending guide at once (the unconscious step if there is one).
    pending = state.pending_guide_id if state.phase == "confirming" else None
    if pending:
        unconscious = get_guide(pending).unconscious_step
        step = unconscious if signs.awake is False and unconscious is not None else 0
        effects.append(ShowStep(pending, step))
        return replace(nxt, phase="guiding", guide_id=pending, pending_guide_id=None, step_index=step), effects

    # An open guide with a step for an unconscious victim: jump there.
    if state.guide_id and signs.awake is False:
        unconscious = get_guide(state.guide_id).unconscious_step
        if unconscious is not None and state.step_index != unconscious:
            effects.append(ShowStep(state.guide_id, unconscious))
            return replace(nxt, phase="guiding", step_index=unconscious), effects
    return nxt, effects


def _sign_text(value: bool | None, yes: str, no: str) -> str:
    return "chưa rõ" if value is None else (yes if value else no)


def handoff_summary(state: CallState, now: float | None = None) -> str:
    """Hand-over note for medical staff, assembled deterministically from the state (never by the model)."""
    minutes = max(1, round(((now if now is not None else time.time()) - state.started_at) / 60))
    parts = [f"Thông tin bàn giao cho nhân viên y tế. Cuộc gọi kéo dài khoảng {minutes} phút."]
    if state.guide_id:
        guide = get_guide(state.guide_id)
        if state.guide_id in state.completed_guides:
            reached = "đã làm hết các bước"
        else:
            reached = f"đã làm tới bước {(state.step_index or 0) + 1} trên {len(guide.steps)}"
        parts.append(f"Đã sơ cứu theo hướng dẫn {guide.title}, {guide.method.lower()}, {reached}.")
    else:
        parts.append("Chưa thực hiện hướng dẫn sơ cứu nào.")
    parts.append(
        f"Tình trạng nạn nhân: {_sign_text(state.signs.awake, 'còn tỉnh', 'bất tỉnh')}, "
        f"{_sign_text(state.signs.breathing, 'còn thở', 'không thở')}."
    )
    return " ".join(parts)


#: Tools the model may use in each phase (the tool names the model sees).
PHASE_TOOLS: dict[CallPhase, frozenset[str]] = {
    "triage": frozenset({"openFirstAidGuide", "updateVictimSigns"}),
    "confirming": frozenset({"openFirstAidGuide", "updateVictimSigns"}),
    "guiding": frozenset({"guideStep", "answerFromGuide", "updateVictimSigns", "handOff"}),
    "monitoring": frozenset({"guideStep", "answerFromGuide", "updateVictimSigns", "handOff"}),
    "handoff": frozenset({"guideStep", "answerFromGuide", "updateVictimSigns"}),
}


def all_guides_text() -> str:
    """Every guide word for word with `[n]` line numbers. It goes into the session's static instructions as reference
    for `answerFromGuide`; it is deliberately *not* repeated in tool results, where the model would read it aloud
    instead of the script the system hands it."""
    return "\n\n".join(guide_text(guide.id) for guide in FIRST_AID_GUIDES)


def guide_text(guide_id: str) -> str:
    """Every step word for word, with `[n]` line numbers, so the model can point `answerFromGuide` at the right line."""
    guide = get_guide(guide_id)
    out = []
    for index, step in enumerate(guide.steps):
        lines = step_lines(step.text)
        body = lines[0].text if len(lines) == 1 else " ".join(f"[{n}] {line.text}" for n, line in enumerate(lines, 1))
        out.append(f'Bước {index + 1} "{step.title}": {body}')
    return f'Nội dung nguyên văn các bước của hướng dẫn "{guide.title}":\n' + "\n".join(out)


def phase_brief(state: CallState) -> str:
    """The call's current state in one line, returned with tool results (the rules themselves live in the prompt)."""
    s = state.signs
    signs = ", ".join(
        [
            _sign_text(s.awake, "còn tỉnh", "bất tỉnh"),
            _sign_text(s.breathing, "còn thở", "không thở"),
            _sign_text(s.talking, "nói/ho được", "không nói/ho được"),
        ]
    )
    where = {"triage": "phân loại", "confirming": "chờ xác nhận", "monitoring": "theo dõi", "handoff": "bàn giao"}
    guide = get_guide(state.guide_id) if state.guide_id else None
    if state.phase == "guiding" and guide and state.step_index is not None:
        position = f'hướng dẫn "{guide.title}", bước {state.step_index + 1}/{len(guide.steps)}'
    else:
        position = where.get(state.phase, state.phase)
    return f"Trạng thái: {position}. Nạn nhân: {signs}."
