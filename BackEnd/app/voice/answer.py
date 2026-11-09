"""Extractive answers about the open guide, ported from `demo-voice` (`src/lib/first-aid/answer.ts`).

The model only chooses which step/lines contain the answer (or says the guide does not cover it); the sentence
that is spoken is assembled here from the source text, so the model never writes medical content itself.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.voice.guides import Guide, join_lines, step_lines

REASSURANCE_LINES = {"none": "", "calm": "Bạn bình tĩnh nhé.", "doing-well": "Bạn đang làm tốt lắm."}
NOT_COVERED_LINE = "Hướng dẫn không nói về điều này, bạn hãy hỏi tổng đài 115 nhé."
PARTLY_COVERED_LINE = "Phần còn lại hướng dẫn không nói tới, bạn hãy hỏi thêm tổng đài 115."

ANSWER_DESCRIPTION = (
    "Trả lời câu hỏi của người dùng về cách sơ cứu bằng chính nội dung hướng dẫn đang mở; hệ thống tự đọc nguyên "
    "văn phần được chọn. Trước hết xác định coverage (hướng dẫn trả lời câu hỏi tới đâu), rồi chọn đúng đoạn "
    "TRẢ LỜI TRỰC TIẾP câu hỏi."
)


class Quote(BaseModel):
    model_config = ConfigDict(extra="forbid")

    step: Annotated[int, Field(ge=1, description="Số thứ tự bước chứa câu trả lời, bắt đầu từ 1")]
    lines: Annotated[
        list[Annotated[int, Field(ge=1)]] | None,
        Field(description="Số thứ tự các dòng [n] trong bước chứa câu trả lời; bỏ trống để trích cả bước"),
    ] = None


class AnswerInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    coverage: Annotated[
        Literal["full", "partial", "none"],
        Field(
            description=(
                '"full": hướng dẫn trả lời trực tiếp toàn bộ câu hỏi. "partial": trả lời được một phần, phần còn '
                'lại hướng dẫn không nói tới. "none": hướng dẫn không trả lời câu hỏi này (kể cả khi có bước nói '
                "về chủ đề gần giống nhưng là kỹ thuật/tình huống khác)."
            )
        ),
    ]
    quotes: Annotated[
        list[Quote],
        Field(
            max_length=2,
            description='Chỉ những đoạn trả lời trực tiếp câu hỏi (thường 1). Rỗng khi coverage là "none".',
        ),
    ]
    reassurance: Annotated[
        Literal["none", "calm", "doing-well"],
        Field(
            description=(
                'Câu trấn an cố định đọc trước câu trả lời: "calm" nếu người dùng hoảng hốt, "doing-well" để '
                'động viên, không thì "none"'
            )
        ),
    ]


def _quoted_lines(text: str, picked: list[int] | None) -> list[str]:
    """Picked lines, plus the nearest heading above a bullet so "Chuẩn bị dụng cụ: …" keeps its context."""
    lines = step_lines(text)
    if not picked:
        return [line.text for line in lines]
    indexes: set[int] = set()
    for number in picked:
        index = number - 1
        if lines[index].bullet:
            header = next((i for i in range(index - 1, -1, -1) if not lines[i].bullet), None)
            if header is not None:
                indexes.add(header)
        indexes.add(index)
    return [lines[i].text for i in sorted(indexes)]


def _lower_first(text: str) -> str:
    return text[:1].lower() + text[1:]


def compose_answer(guide: Guide, current_step: int, answer: AnswerInput) -> dict[str, str]:
    """`{'speech': ...}` assembled from the source text, or `{'error': ...}` so the model can choose again."""
    if answer.coverage == "none" and answer.quotes:
        return {"error": 'coverage là "none" thì quotes phải rỗng: không trích đoạn không trả lời câu hỏi.'}
    if answer.coverage != "none" and not answer.quotes:
        return {"error": f'coverage là "{answer.coverage}" thì cần ít nhất một đoạn trích trả lời câu hỏi.'}

    parts: list[str] = []
    for quote in answer.quotes:
        if quote.step > len(guide.steps):
            return {"error": f"Hướng dẫn chỉ có {len(guide.steps)} bước."}
        step = guide.steps[quote.step - 1]
        line_count = len(step_lines(step.text))
        if quote.lines and (bad := next((n for n in quote.lines if n > line_count), None)) is not None:
            return {"error": f"Bước {quote.step} chỉ có {line_count} dòng (không có dòng {bad})."}
        body = join_lines(_quoted_lines(step.text, quote.lines))
        if quote.step - 1 == current_step:
            parts.append(f"Theo hướng dẫn, {_lower_first(body)}.")
        else:
            parts.append(f"Ở bước {quote.step}, hướng dẫn nói: {body}.")
    if answer.coverage == "partial":
        parts.append(PARTLY_COVERED_LINE)
    if answer.coverage == "none":
        parts.append(NOT_COVERED_LINE)
    speech = " ".join(p for p in [REASSURANCE_LINES[answer.reassurance], *parts] if p)
    return {"speech": speech}
