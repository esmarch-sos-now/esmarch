# ruff: noqa: E501  (the prompts are long Vietnamese paragraphs; wrapping them would change what the model reads)
"""The first-aid voice agent: same business rules as `demo-voice`, on a Pydantic AI realtime session.

The realtime model hears the caller, picks tools, and speaks naturally. It writes no medical content itself: a tool
that has something to say returns it as `{"say": ...}`, the facts the model puts into its own words (OpenAI advises
giving the voice model facts, not a script). A tool with nothing to say returns nothing to say.
A realtime session fixes its tools when it connects, so the phase gating `demo-voice` did per turn (`PHASE_TOOLS`)
is enforced inside each tool.
"""

import functools
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic_ai import Agent, RunContext

from app.voice.answer import ANSWER_DESCRIPTION, AnswerInput, compose_answer
from app.voice.call_state import (
    PHASE_TOOLS,
    RED_FLAG_LINE,
    CallEffect,
    CallEvent,
    CallState,
    GuideCompleted,
    GuideOpened,
    GuideProposed,
    Handoff,
    Say,
    ShowStep,
    SignsUpdated,
    StepChanged,
    VictimSigns,
    all_guides_text,
    phase_brief,
    reduce_call,
)
from app.voice.guides import FIRST_AID_GUIDES, GuideId, get_guide, guide_intro, step_lines, step_speech

Emit = Callable[[dict[str, Any]], None]


@dataclass
class CallSession:
    """Everything one call needs: its state, the screen, and what the model should say next."""

    emit: Emit
    """Send a screen message to the browser."""
    state: CallState = field(default_factory=CallState)
    shown_guide: str | None = None
    """The guide the screen currently shows (its intro is read when a different guide opens)."""
    pending: list[str] = field(default_factory=list)
    """Sentences queued by the running tool; `reads_aloud` puts them in its result."""
    exact: list[str] = field(default_factory=list)
    """Lines that must be said word for word (the 115 call-out)."""
    handed_off: bool = False
    """The hand-over was given: once it has been spoken the call ends by itself."""

    def say(self, text: str, *, exact: bool = False) -> None:
        (self.exact if exact else self.pending).append(text)

    # ---- state ---------------------------------------------------------------------------------

    def dispatch(self, event: CallEvent) -> CallState:
        """Move the call to its next state, then carry out the effects (spoken sentences, showing a step)."""
        before = self.state.phase
        if isinstance(event, Handoff):
            self.handed_off = True
        self.state, effects = reduce_call(self.state, event)
        for effect in effects:
            self._apply(effect)
        if self.state.phase != before or isinstance(event, Handoff):
            self.emit({"type": "phase", "phase": self.state.phase})
        if isinstance(event, Handoff):
            self.emit(
                {"type": "handoff", "summary": effects[0].text if effects and isinstance(effects[0], Say) else ""}
            )
        return self.state

    def _apply(self, effect: CallEffect) -> None:
        match effect:
            case Say(text):
                self.say(text, exact=text == RED_FLAG_LINE)
            case ShowStep(guide_id, step_index):
                self._show(guide_id, step_index)

    def _show(self, guide_id: str, step_index: int) -> None:
        """Put a step on screen and queue its narration for the assistant (preceded by the guide intro when opening
        a new guide)."""
        guide = get_guide(guide_id)
        if self.shown_guide != guide_id:
            self.say(guide_intro(guide))
        self.say(step_speech(guide, step_index))
        self.shown_guide = guide_id
        self.emit(
            {
                "type": "step",
                "guideId": guide_id,
                "file": guide.file,
                "stepIndex": step_index,
                "title": guide.title,
                "method": guide.method,
                "stepTitle": guide.steps[step_index].title,
                "lines": [line.text for line in step_lines(guide.steps[step_index].text)],
                "totalSteps": len(guide.steps),
            }
        )

    def present_step(self, guide_id: str, step_index: int) -> dict[str, Any]:
        """Open a guide at a step. A victim already known to be unconscious goes straight to the step made for it."""
        guide = get_guide(guide_id)
        unconscious = guide.unconscious_step
        if step_index == 0 and self.state.signs.awake is False and unconscious is not None:
            index = unconscious
        else:
            index = min(max(step_index, 0), len(guide.steps) - 1)
        same_guide = self.state.guide_id == guide_id
        self._show(guide_id, index)
        self.dispatch(StepChanged(index) if same_guide else GuideOpened(guide_id, index))
        return self.step_result(guide_id, index)

    def step_result(self, guide_id: str, index: int) -> dict[str, Any]:
        """Deliberately free of readable content, so the model has nothing to paraphrase."""
        return {
            "shown": {"guideId": guide_id, "step": index + 1, "totalSteps": len(get_guide(guide_id).steps)},
            "isLastStep": index == len(get_guide(guide_id).steps) - 1,
            "brief": phase_brief(self.state),
        }

    def sync_with_client(self, guide_id: str, step_index: int) -> None:
        """The caller moved the on-screen step by hand: follow it silently (no speech)."""
        try:
            guide = get_guide(guide_id)
        except KeyError:
            return
        if not 0 <= step_index < len(guide.steps):
            return
        self.shown_guide = guide_id
        if guide_id != self.state.guide_id:
            self.state, _ = reduce_call(self.state, GuideOpened(guide_id, step_index))
        elif step_index != self.state.step_index and self.state.phase == "guiding":
            self.state, _ = reduce_call(self.state, StepChanged(step_index))
        self.emit({"type": "phase", "phase": self.state.phase})


def reads_aloud(tool: Callable[..., Awaitable[dict[str, Any]]]) -> Callable[..., Awaitable[dict[str, Any]]]:
    """Hand the model what the tool queued to say: `say` (facts it puts in its own words) and `must_say_exactly`."""

    @functools.wraps(tool)
    async def wrapper(ctx: RunContext[CallSession], *args: Any, **kwargs: Any) -> dict[str, Any]:
        result, call = await tool(ctx, *args, **kwargs), ctx.deps
        if call.pending:
            result = {**result, "say": " ".join(call.pending)}
            call.pending.clear()
        if call.exact:
            result = {**result, "must_say_exactly": " ".join(call.exact)}
            call.exact.clear()
        return result

    return wrapper


# ---- instructions -----------------------------------------------------------------------------------

GUIDE_CATALOG = "\n".join(
    f'- guideId "{g.id}": {g.title} ({g.method}), {len(g.steps)} bước. Dùng khi: {g.when_to_use}'
    for g in FIRST_AID_GUIDES
)

#: GPT-Live's own prompt: it never sees `INSTRUCTIONS` (those go to the backend that runs the tools). Follows
#: OpenAI's template (identity, style, Backchannel / Interruption / Delegation policy) and is written in the language
#: it speaks.
LIVE_INSTRUCTIONS = """Bạn là giọng nói của trợ lý sơ cứu, đang nói chuyện điện thoại với một người đang sơ cứu cho nạn nhân. Bạn xưng "mình" và gọi người gọi là "bạn". Nói tiếng Việt giọng miền Nam, trừ khi người gọi muốn đổi ngôn ngữ.

Hãy nói như một người thật, bình tĩnh và gọn: thường một hai câu, tự chọn cách diễn đạt, không cần theo mẫu. Hướng dẫn thì nói rõ, hơi chậm, từng bước một rồi chờ người gọi. Bạn không phải bác sĩ: không chẩn đoán, không nói về thuốc, không hứa nạn nhân sẽ ổn.

Backchannel policy:
- Khi người gọi kể dài, thỉnh thoảng đệm ngắn ("dạ", "vâng"); không chen vào lúc họ đang nói.

Interruption policy:
- Khi người gọi chen ngang, dừng ngay và nghe; "khoan", "đợi đã" thì dừng không cần hỏi lại. Đừng đọc tiếp kết quả cũ nếu họ đã nói điều mới.

Delegation policy:
Backend tools: ghi nhận tình trạng nạn nhân, mở hoặc chuyển bước hướng dẫn, trả lời câu hỏi về cách làm, bàn giao.
Generate <|SpawnThinking|> when:
- Người gọi mô tả tình huống, báo tình trạng nạn nhân, nói "xong", "tiếp", "nhắc lại", hoặc hỏi cách làm.
- Người gọi sửa lại điều đã nói.
- Đội cấp cứu đã tới, hoặc người gọi nói đã xong, cảm ơn hay muốn kết thúc: để backend bàn giao và kết thúc cuộc gọi.
Do not generate <|SpawnThinking|> when:
- Chỉ là tiếng ho, tiếng nền, hoặc lời không nói với bạn.
- Nghe không rõ: xin nói lại, đừng đoán.
- Chào hoặc cảm ơn: đáp ngắn.
Generate <|SpawnThinking|> before any answer that depends on the backend. Trong lúc chờ không đoán kết quả.

Khi có kết quả: nói lại bằng lời của bạn nhưng giữ đủ mọi hành động, con số, vị trí và thứ tự, không thêm kỹ thuật sơ cứu nào khác. Phần "must_say_exactly" thì đọc đúng từng chữ. Khi hình hướng dẫn hiện lên màn hình thì báo người gọi một câu trước khi nói bước đầu. Nếu không có gì để nói thì im lặng."""

INSTRUCTIONS = f"""## Voice conversation context
Bạn là bộ não của trợ lý sơ cứu trong một cuộc gọi thoại: hiểu người gọi, chọn công cụ và trả về điều cần nói; giọng nói (Live) sẽ nói lại. Người gọi đang hoảng nên có thể nói đứt quãng hoặc nghe không rõ. Bạn không có kiến thức sơ cứu riêng: mọi nội dung sơ cứu chỉ lấy từ công cụ và tài liệu bên dưới.

Các hướng dẫn có sẵn:
{GUIDE_CATALOG}

## Task instructions
- Lúc chưa có hướng dẫn, hỏi tự nhiên để hiểu tình huống (chuyện gì xảy ra, nạn nhân còn tỉnh, còn thở, nói được không). Không đưa lời khuyên y tế, cách xử lý, thuốc hay chẩn đoán khi chưa có kết quả công cụ.
- Người gọi nói về tình trạng nạn nhân: updateVictimSigns, chỉ điền điều họ nói. Nguy kịch mà chưa mở hướng dẫn: updateVictimSigns rồi openFirstAidGuide trong cùng lượt.
- Tình huống khớp rõ một hướng dẫn: openFirstAidGuide (callerConfirmed=false để hệ thống hỏi xác nhận; sau khi họ đồng ý, gọi lại với callerConfirmed=true). Mơ hồ thì hỏi một câu làm rõ.
- Đang hướng dẫn: "xong/tiếp" là guideStep next, "quay lại" là previous, "nhắc lại" là repeat, đi tới bước cụ thể là goto. Câu hỏi về cách làm: answerFromGuide, chọn đúng bước và dòng khớp hành động được hỏi (ví dụ ở "ep-bung", hỏi "ép mấy lần, mạnh cỡ nào" thì coverage "partial", quotes [{{step: 4}}]; hỏi điều hướng dẫn không nói tới thì "none", quotes []).
- handOff khi đội cấp cứu hoặc nhân viên y tế đã tới, khi đã làm xong các bước mà người gọi nói không cần gì thêm, hoặc khi người gọi muốn kết thúc: gọi ngay, không chờ họ nói lại. handOff cũng kết thúc cuộc gọi sau khi lời bàn giao được nói xong.
- Chỉ gọi công cụ khi chắc ý người gọi. Lời nói đứt quãng hoặc vô nghĩa thì xin nói lại, đừng đoán.
- Chưa có hướng dẫn phù hợp: nói chưa có và nhắc gọi 115, không tự chế cách xử lý.
- Công cụ trả lỗi: nói ngắn bằng lời thường rồi nêu bước tiếp.
- Khi nạn nhân nguy kịch, hệ thống tự thêm dòng nhắc gọi 115 vào "must_say_exactly" một lần; đừng lặp lại.

## Return the result
Công cụ trả "say" (sự việc cần nói) và có thể kèm "must_say_exactly" (đọc đúng từng chữ). Không có "say" thì không nói thêm gì.

## Tài liệu tham khảo (chỉ để chọn bước và dòng cho answerFromGuide; không đọc ra)
{all_guides_text()}
"""


def _blocked(ctx: RunContext[CallSession], tool: str) -> dict[str, Any] | None:
    """Phase gating: the demo hid tools per turn; a realtime session cannot, so refuse here."""
    phase = ctx.deps.state.phase
    if tool in PHASE_TOOLS[phase]:
        return None
    return {
        "error": f"Công cụ {tool} không dùng được ở giai đoạn hiện tại ({phase}).",
        "allowedTools": sorted(PHASE_TOOLS[phase]),
        "brief": phase_brief(ctx.deps.state),
    }


class VictimSignsInput(BaseModel):
    model_config = ConfigDict(extra="forbid")  # a misspelt field is an error to retry, not silently lost data

    awake: Annotated[bool | None, Field(description="true nếu nạn nhân còn tỉnh, false nếu bất tỉnh/ngất")] = None
    breathing: Annotated[bool | None, Field(description="true nếu nạn nhân còn thở, false nếu không thở")] = None
    talking: Annotated[bool | None, Field(description="true nếu nạn nhân còn nói hoặc ho được, false nếu không")] = None


def build_agent() -> Agent[CallSession, str]:
    agent: Agent[CallSession, str] = Agent(deps_type=CallSession, instructions=INSTRUCTIONS)

    @agent.tool(name="openFirstAidGuide")
    @reads_aloud
    async def open_guide(
        ctx: RunContext[CallSession], guideId: GuideId, callerConfirmed: bool = False
    ) -> dict[str, Any]:
        """Mở hướng dẫn sơ cứu phù hợp tình huống. Với tình huống chưa nguy kịch, gọi với callerConfirmed=false để hệ
        thống hỏi người gọi xác nhận; sau khi họ nói rõ là đúng, gọi lại cùng guideId với callerConfirmed=true. Nếu nạn
        nhân bất tỉnh hoặc không thở, hệ thống mở hướng dẫn ngay và không chờ xác nhận."""
        if blocked := _blocked(ctx, "openFirstAidGuide"):
            return blocked
        call, guide = ctx.deps, get_guide(guideId)
        confirmed = callerConfirmed and call.state.phase == "confirming" and call.state.pending_guide_id == guideId
        if call.state.signs.critical or confirmed:
            return call.present_step(guideId, 0)
        call.dispatch(GuideProposed(guideId))
        call.say(
            f"Có vẻ là tình huống {guide.title.lower()}. Hãy hỏi người gọi một câu tự nhiên để chắc đúng tình huống "
            "này, rồi mới mở hình hướng dẫn."
        )
        return {
            "status": "awaiting_confirmation",
            "guideId": guideId,
            "guideTitle": guide.title,
            "brief": phase_brief(call.state),
        }

    @agent.tool(name="guideStep")
    @reads_aloud
    async def guide_step(
        ctx: RunContext[CallSession],
        action: Literal["next", "previous", "repeat", "goto"],
        step: Annotated[int | None, Field(ge=1, description="Số thứ tự bước (từ 1), chỉ dùng với goto")] = None,
        guideId: GuideId | None = None,
    ) -> dict[str, Any]:
        """Chuyển bước trong hướng dẫn đang mở: next (bước tiếp, "xong" ở bước cuối là hoàn thành), previous, repeat
        (lặp lại bước hiện tại) hoặc goto (tới bước chỉ định, có thể kèm guideId để đổi hướng dẫn)."""
        if blocked := _blocked(ctx, "guideStep"):
            return blocked
        call, state = ctx.deps, ctx.deps.state
        if action == "goto":
            target_guide = guideId or state.guide_id
            if target_guide is None or step is None:
                return {"error": "Cần nêu số bước (và hướng dẫn nếu chưa mở hướng dẫn nào)."}
            return call.present_step(target_guide, step - 1)
        if not state.guide_id:
            return {"error": "Chưa mở hướng dẫn nào. Hãy hỏi tình huống rồi dùng openFirstAidGuide."}
        current, total = state.step_index or 0, len(get_guide(state.guide_id).steps)
        # "Xong" on the last step completes the guide and moves on to monitoring.
        if action == "next" and current == total - 1:
            call.dispatch(GuideCompleted())
            return {"completed": True, "brief": phase_brief(call.state)}
        target = current + {"next": 1, "previous": -1, "repeat": 0}[action]
        if target >= total:
            return {"error": f"Đã ở bước cuối (bước {total}) của hướng dẫn."}
        if target < 0:
            return {"error": "Đang ở bước đầu tiên của hướng dẫn."}
        return call.present_step(state.guide_id, target)

    @agent.tool(name="answerFromGuide", description=ANSWER_DESCRIPTION)
    @reads_aloud
    async def answer_from_guide(ctx: RunContext[CallSession], answer: AnswerInput) -> dict[str, Any]:
        if blocked := _blocked(ctx, "answerFromGuide"):
            return blocked
        call = ctx.deps
        if not call.state.guide_id:
            return {"error": "Chưa mở hướng dẫn nào để trích dẫn."}
        composed = compose_answer(get_guide(call.state.guide_id), call.state.step_index or 0, answer)
        if "error" in composed:
            return composed
        call.say(composed["speech"])
        return {}

    @agent.tool(name="updateVictimSigns")
    @reads_aloud
    async def update_signs(ctx: RunContext[CallSession], signs: VictimSignsInput) -> dict[str, Any]:
        """Ghi nhận tình trạng nạn nhân mà người dùng vừa mô tả (tỉnh hay bất tỉnh, còn thở không, còn nói/ho được
        không). Chỉ điền trường người dùng thật sự nói tới. Nếu nạn nhân nguy kịch, hệ thống tự nhắc gọi 115 và chuyển
        bước phù hợp."""
        if blocked := _blocked(ctx, "updateVictimSigns"):
            return blocked
        call = ctx.deps
        before = call.state
        after = call.dispatch(SignsUpdated(VictimSigns(signs.awake, signs.breathing, signs.talking)))
        call.emit(
            {
                "type": "signs",
                "awake": after.signs.awake,
                "breathing": after.signs.breathing,
                "talking": after.signs.talking,
            }
        )
        return {
            "phase": after.phase,
            "signs": {"awake": after.signs.awake, "breathing": after.signs.breathing, "talking": after.signs.talking},
            # The system already spoke (115 reminder, step change): the model must not repeat it.
            "handledBySystem": after.red_flag_announced != before.red_flag_announced
            or after.step_index != before.step_index,
            "brief": phase_brief(after),
        }

    @agent.tool(name="handOff")
    @reads_aloud
    async def hand_off(ctx: RunContext[CallSession]) -> dict[str, Any]:
        """Bàn giao khi đội cấp cứu đã tới, đã tới cơ sở y tế hoặc người dùng muốn kết thúc: hệ thống đọc và hiển thị
        thông tin bàn giao."""
        if blocked := _blocked(ctx, "handOff"):
            return blocked
        call = ctx.deps
        call.dispatch(Handoff())
        return {"callEnding": "Cuộc gọi kết thúc ngay sau lời này: nói thông tin bàn giao rồi chào tạm biệt ngắn gọn."}

    return agent
