"""Business rules of the first-aid voice agent (ported from `demo-voice`): state machine, scripted speech, tools."""

from typing import Any

import pytest
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    RetryPromptPart,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
)
from pydantic_ai.models.function import AgentInfo, FunctionModel

from app.voice.agent import CallSession, build_agent
from app.voice.answer import AnswerInput, Quote, compose_answer
from app.voice.call_state import (
    GUIDE_COMPLETED_LINE,
    PHASE_TOOLS,
    RED_FLAG_LINE,
    CallState,
    GuideCompleted,
    GuideOpened,
    GuideProposed,
    Handoff,
    Say,
    SignsUpdated,
    VictimSigns,
    handoff_summary,
    reduce_call,
)
from app.voice.guides import FIRST_AID_GUIDES, get_guide, guide_intro, join_lines, step_lines, step_speech

pytestmark = pytest.mark.anyio

EP_BUNG = get_guide("ep-bung")


# ---- guide data & speech ----------------------------------------------------------------------------


def test_every_unconscious_step_exists() -> None:
    for guide in FIRST_AID_GUIDES:
        assert guide.unconscious_step is None or 0 <= guide.unconscious_step < len(guide.steps)
    assert EP_BUNG.steps[EP_BUNG.unconscious_step or 0].title == "Hồi sinh tim phổi"


def test_join_lines_makes_one_sentence_and_the_intro_names_the_guide() -> None:
    nep = get_guide("gay-xuong-dui")
    assert join_lines(["Chuẩn bị dụng cụ:", "2 nẹp;", "9 dây buộc;"]) == "Chuẩn bị dụng cụ: 2 nẹp, 9 dây buộc"
    assert join_lines(["a;", "b."]) == "a, b"
    assert [line.bullet for line in step_lines(nep.steps[0].text)] == [False, True, True, True]
    assert "gồm 8 bước" in guide_intro(EP_BUNG)


# ---- reducer -----------------------------------------------------------------------------------------


def test_red_flag_is_announced_once_and_rearmed_when_the_victim_recovers() -> None:
    state = CallState()
    state, effects = reduce_call(state, SignsUpdated(VictimSigns(breathing=False)))
    assert [e for e in effects] == [Say(RED_FLAG_LINE)] and state.red_flag_announced
    state, effects = reduce_call(state, SignsUpdated(VictimSigns(talking=False)))
    assert effects == []  # still critical, already announced
    state, _ = reduce_call(state, SignsUpdated(VictimSigns(breathing=True)))
    assert not state.red_flag_announced
    _, effects = reduce_call(state, SignsUpdated(VictimSigns(awake=False)))
    assert [e for e in effects] == [Say(RED_FLAG_LINE)]


def test_critical_victim_opens_the_pending_guide_at_the_unconscious_step() -> None:
    state, _ = reduce_call(CallState(), GuideProposed("ep-bung"))
    assert state.phase == "confirming"
    state, effects = reduce_call(state, SignsUpdated(VictimSigns(awake=False)))
    assert (state.phase, state.guide_id, state.step_index) == ("guiding", "ep-bung", 6)
    assert [type(e).__name__ for e in effects] == ["Say", "ShowStep"]


def test_unconscious_victim_jumps_an_open_guide_to_its_unconscious_step() -> None:
    state, _ = reduce_call(CallState(), GuideOpened("ep-bung", 2))
    state, effects = reduce_call(state, SignsUpdated(VictimSigns(awake=False)))
    assert state.step_index == 6 and [type(e).__name__ for e in effects] == ["Say", "ShowStep"]
    # a guide without such a step just keeps its place
    other, _ = reduce_call(CallState(), GuideOpened("xuc-thia", 2))
    other, effects = reduce_call(other, SignsUpdated(VictimSigns(awake=False)))
    assert other.step_index == 2 and [type(e).__name__ for e in effects] == ["Say"]


def test_completion_and_handoff() -> None:
    state, _ = reduce_call(CallState(started_at=0), GuideOpened("ep-bung", 7))
    done, effects = reduce_call(state, GuideCompleted())
    assert done.phase == "monitoring" and done.completed_guides == ("ep-bung",)
    assert effects[0].text == GUIDE_COMPLETED_LINE  # type: ignore[union-attr]
    ended, effects = reduce_call(done, Handoff(), now=5 * 60)
    summary = effects[0].text  # type: ignore[union-attr]
    assert ended.phase == "handoff" and summary == handoff_summary(done, 5 * 60)
    assert "khoảng 5 phút" in summary and "đã làm hết các bước" in summary
    assert "Chưa thực hiện hướng dẫn sơ cứu nào." in handoff_summary(CallState(started_at=0), 30)


def test_phase_tool_table_matches_the_demo() -> None:
    assert PHASE_TOOLS["triage"] == {"openFirstAidGuide", "updateVictimSigns"} == PHASE_TOOLS["confirming"]
    assert PHASE_TOOLS["guiding"] == PHASE_TOOLS["monitoring"] and "guideStep" in PHASE_TOOLS["handoff"]
    assert "handOff" in PHASE_TOOLS["guiding"] and "handOff" not in PHASE_TOOLS["handoff"]


# ---- extractive answers ------------------------------------------------------------------------------


def answer(coverage: str, quotes: list[Quote], reassurance: str = "none", current: int = 3) -> dict[str, str]:
    return compose_answer(EP_BUNG, current, AnswerInput(coverage=coverage, quotes=quotes, reassurance=reassurance))  # type: ignore[arg-type]


def test_answers_are_quoted_not_written() -> None:
    assert answer("full", [Quote(step=3)], "calm")["speech"] == (
        "Bạn bình tĩnh nhé. Ở bước 3, hướng dẫn nói: Vòng hai tay phía trước bụng nạn nhân, một tay nắm đặt vào vị trí "
        "giữa rốn và mũi ức, tay kia bọc ra ngoài bàn tay trước."
    )
    assert answer("partial", [Quote(step=4)])["speech"].startswith("Theo hướng dẫn, ép bụng đột ngột")
    assert answer("partial", [Quote(step=4)])["speech"].endswith("hãy hỏi thêm tổng đài 115.")
    assert answer("none", [])["speech"] == "Hướng dẫn không nói về điều này, bạn hãy hỏi tổng đài 115 nhé."


def test_a_bullet_keeps_its_heading() -> None:
    prep = get_guide("gay-xuong-dui")
    out = compose_answer(prep, 0, AnswerInput(coverage="full", quotes=[Quote(step=1, lines=[2])], reassurance="none"))
    assert out["speech"] == "Theo hướng dẫn, chuẩn bị dụng cụ: 2 nẹp."


@pytest.mark.parametrize(
    ("coverage", "quotes"),
    [("none", [Quote(step=1)]), ("full", []), ("full", [Quote(step=99)]), ("full", [Quote(step=1, lines=[5])])],
)
def test_inconsistent_answers_are_sent_back_to_the_model(coverage: str, quotes: list[Quote]) -> None:
    assert "error" in answer(coverage, quotes)


# ---- tools, driven through a scripted model ---------------------------------------------------------


CONFIRM_FACT = (
    "Có vẻ là tình huống sơ cứu hóc dị vật. Hãy hỏi người gọi một câu tự nhiên để chắc đúng tình huống này, "
    "rồi mới mở hình hướng dẫn."
)


class Harness:
    def __init__(self) -> None:
        self.screen: list[dict[str, Any]] = []
        self.call = CallSession(
            emit=self.screen.append,
            state=CallState(started_at=0),
        )

        self.spoken: list[str] = []
        say = self.call.say
        self.call.say = lambda text, **kw: (self.spoken.append(text), say(text, **kw))[1]  # type: ignore[method-assign]

    async def run(self, *steps: tuple[str, dict[str, Any]]) -> list[Any]:
        """Call each tool in order as the model would; returns every tool result (or retry prompt)."""
        queue, results = iter(steps), []

        def model(messages: list[ModelMessage], _: AgentInfo) -> ModelResponse:
            last = messages[-1]
            if isinstance(last, ModelRequest):
                for part in last.parts:
                    if isinstance(part, ToolReturnPart | RetryPromptPart):
                        results.append(part.content)
            step = next(queue, None)
            return ModelResponse(parts=[ToolCallPart(*step)] if step else [TextPart("xong")])

        await build_agent().run("x", model=FunctionModel(model), deps=self.call)
        return results


async def test_confirmed_guide_is_read_in_order_and_shown() -> None:
    h = Harness()
    out = await h.run(
        ("openFirstAidGuide", {"guideId": "ep-bung"}),
        ("openFirstAidGuide", {"guideId": "ep-bung", "callerConfirmed": True}),
    )
    assert out[0]["status"] == "awaiting_confirmation"
    assert h.spoken == [
        CONFIRM_FACT,
        guide_intro(EP_BUNG),
        step_speech(EP_BUNG, 0),
    ]
    assert h.call.state.phase == "guiding" and h.call.state.step_index == 0
    assert [m["type"] for m in h.screen] == ["phase", "step", "phase"]
    assert h.screen[1]["lines"] == ["Nạn nhân đứng đầu cúi thấp, miệng há ra."]


async def test_tools_outside_their_phase_are_refused() -> None:
    h = Harness()
    out = await h.run(
        ("guideStep", {"action": "next"}),
        ("answerFromGuide", {"answer": {"coverage": "none", "quotes": [], "reassurance": "none"}}),
        ("handOff", {}),
    )
    assert all("error" in r and "allowedTools" in r for r in out[:3])
    assert h.spoken == [] and h.call.state.phase == "triage"


async def test_critical_victim_skips_confirmation_and_goes_to_the_unconscious_step() -> None:
    h = Harness()
    out = await h.run(
        ("updateVictimSigns", {"awake": False, "breathing": False}),
        ("openFirstAidGuide", {"guideId": "ep-bung"}),
    )
    assert out[0]["handledBySystem"] is True
    assert out[1]["shown"]["step"] == 7  # opened at once, at the step made for an unconscious victim
    assert h.spoken == [RED_FLAG_LINE, guide_intro(EP_BUNG), step_speech(EP_BUNG, 6)]
    assert h.call.state.step_index == 6


async def test_navigation_and_completion() -> None:
    h = Harness()
    xuc_thia = get_guide("xuc-thia")
    h.call.state, _ = reduce_call(h.call.state, GuideOpened("xuc-thia", 5))
    h.call.shown_guide = "xuc-thia"  # the screen already shows it, so no intro is read
    out = await h.run(
        ("guideStep", {"action": "next"}),  # -> step 7 (last)
        ("guideStep", {"action": "next"}),  # done
        ("guideStep", {"action": "previous"}),  # allowed while monitoring
    )
    assert out[0]["shown"]["step"] == 7 and out[0]["isLastStep"]
    assert out[1]["completed"] is True
    assert h.spoken == [step_speech(xuc_thia, 6), GUIDE_COMPLETED_LINE, step_speech(xuc_thia, 5)]
    assert out[2]["shown"]["step"] == 6
    assert h.call.state.completed_guides == ("xuc-thia",)


async def test_navigating_off_either_end_is_an_error() -> None:
    h = Harness()
    h.call.state, _ = reduce_call(h.call.state, GuideOpened("ep-bung", 0))
    out = await h.run(("guideStep", {"action": "previous"}))
    assert out[0]["error"] == "Đang ở bước đầu tiên của hướng dẫn." and h.spoken == []


async def test_answer_is_scripted_and_handoff_reads_the_summary() -> None:
    h = Harness()
    h.call.state, _ = reduce_call(h.call.state, GuideOpened("ep-bung", 3))
    out = await h.run(
        ("answerFromGuide", {"answer": {"coverage": "none", "quotes": [], "reassurance": "none"}}),
        ("handOff", {}),
    )
    assert h.spoken[0] == "Hướng dẫn không nói về điều này, bạn hãy hỏi tổng đài 115 nhé."
    assert h.spoken[1].startswith("Thông tin bàn giao cho nhân viên y tế.")
    assert out[1]["say"] == h.spoken[1] and h.call.state.phase == "handoff"
    assert {"type": "handoff", "summary": h.spoken[1]} in h.screen


async def test_misspelt_victim_sign_is_an_error_to_retry_not_lost_data() -> None:
    h = Harness()
    out = await h.run(("updateVictimSigns", {"signs": {"consciousH": False}}))
    assert isinstance(out[0], list) or "consciousH" in str(out[0])
    assert h.call.state.signs == VictimSigns()


def test_hand_selected_step_is_followed_silently() -> None:
    h = Harness()
    h.call.sync_with_client("ep-bung", 2)
    assert (h.call.state.phase, h.call.state.guide_id, h.call.state.step_index) == ("guiding", "ep-bung", 2)
    h.call.sync_with_client("ep-bung", 5)
    assert h.call.state.step_index == 5 and h.spoken == []
    h.call.sync_with_client("ep-bung", 99)  # out of range: ignored
    assert h.call.state.step_index == 5


async def test_stepping_reads_the_step_with_the_assistant_voice() -> None:
    h = Harness()
    await h.run(
        ("openFirstAidGuide", {"guideId": "ep-bung"}),
        ("openFirstAidGuide", {"guideId": "ep-bung", "callerConfirmed": True}),
    )
    opened = next(m for m in h.screen if m["type"] == "step")
    assert opened["file"] == "ep-bung-3d.html" and opened["totalSteps"] == 8
    assert h.spoken == [
        CONFIRM_FACT,
        guide_intro(EP_BUNG),
        step_speech(EP_BUNG, 0),
    ]
    h.screen.clear()
    h.spoken.clear()
    [result] = await h.run(("guideStep", {"action": "next"}))
    step = next(m for m in h.screen if m["type"] == "step")
    assert step["stepIndex"] == 1
    assert h.spoken == [step_speech(EP_BUNG, 1)] and result["say"] == step_speech(EP_BUNG, 1)


async def test_a_failed_tool_leaves_the_model_free_to_explain() -> None:
    h = Harness()
    await h.run(("guideStep", {"action": "next"}))
    assert h.spoken == []


async def test_a_tool_with_something_to_say_hands_the_model_the_facts() -> None:
    h = Harness()
    [result] = await h.run(("openFirstAidGuide", {"guideId": "ep-bung"}))
    assert result["say"] == CONFIRM_FACT
    assert not h.call.pending


async def test_the_115_warning_is_handed_over_once_and_nothing_else_is_said() -> None:
    h = Harness()
    [result] = await h.run(("updateVictimSigns", {"signs": {"breathing": False}}))
    assert h.spoken == [RED_FLAG_LINE] and result["must_say_exactly"] == RED_FLAG_LINE and "say" not in result


async def test_handoff_marks_the_call_to_end_after_the_hand_over_is_spoken() -> None:
    h = Harness()
    h.call.state, _ = reduce_call(h.call.state, GuideOpened("ep-bung", 3))
    assert h.call.handed_off is False
    [result] = await h.run(("handOff", {}))
    assert h.call.handed_off is True and "callEnding" in result
