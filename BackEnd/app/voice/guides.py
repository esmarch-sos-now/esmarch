"""First-aid guide data for the voice assistant, ported from `demo-voice` (`src/lib/first-aid/guides.ts`).

Step texts are copied word for word from the 3D guide pages (`FrontEnd/public/guides/*.html`), so what the
assistant reads matches the animation exactly. Nothing here is generated: the assistant may only speak medical
content that comes from these strings.
"""

from dataclasses import dataclass
from typing import Literal, get_args

GuideId = Literal["ep-bung", "gay-xuong-dui", "xuc-thia"]
GUIDE_IDS: tuple[str, ...] = get_args(GuideId)


@dataclass(frozen=True)
class Step:
    title: str
    text: str
    """Original text; a line starting with "– " is a bullet."""
    substeps: tuple[str, ...] = ()


@dataclass(frozen=True)
class Guide:
    id: GuideId
    title: str
    method: str
    when_to_use: str
    file: str
    steps: tuple[Step, ...]
    unconscious_step: int | None = None
    """0-based step of this guide meant for an unconscious victim, if any."""


FIRST_AID_GUIDES: tuple[Guide, ...] = (
    Guide(
        id="ep-bung",
        title="Sơ cứu hóc dị vật",
        method="Phương pháp ép bụng",
        when_to_use="Người lớn hoặc trẻ lớn bị hóc, nghẹn dị vật đường thở, không ho hoặc không nói được.",
        file="ep-bung-3d.html",
        unconscious_step=6,  # step 7: "Nếu nạn nhân bất tỉnh: hồi sinh tim phổi…"
        steps=(
            Step("Tư thế nạn nhân", "Nạn nhân đứng đầu cúi thấp, miệng há ra."),
            Step(
                "Đứng phía sau nạn nhân",
                "Người sơ cấp cứu đứng phía sau nạn nhân luồn một chân vào giữa hai chân nạn nhân.",
            ),
            Step(
                "Đặt tay đúng vị trí",
                "Vòng hai tay phía trước bụng nạn nhân, một tay nắm đặt vào vị trí giữa rốn và mũi ức, "
                "tay kia bọc ra ngoài bàn tay trước.",
            ),
            Step("Ép bụng", "Ép bụng đột ngột, tối đa một lần từ trước ra sau lên trên."),
            Step("Đánh giá sau mỗi lần ép", "Đánh giá sự cải thiện tình trạng của nạn nhân sau mỗi lần ép."),
            Step(
                "Xen kẽ vỗ lưng và ép bụng",
                "Nếu dị vật chưa ra: xen kẽ phương pháp vỗ lưng và ép bụng cho đến khi dị vật bật ra.",
            ),
            Step(
                "Hồi sinh tim phổi",
                "Nếu nạn nhân bất tỉnh: hồi sinh tim phổi cho nạn nhân theo chu trình, bắt đầu bằng động tác ép ngực.",
            ),
            Step("Chuyển tới cơ sở y tế", "Chuyển nạn nhân tới cơ sở y tế sau khi nạn nhân thở trở lại."),
        ),
    ),
    Guide(
        id="gay-xuong-dui",
        title="Cố định gãy xương đùi",
        method="Phương pháp nẹp hai bên",
        when_to_use="Nạn nhân nghi gãy xương đùi cần cố định chân bằng nẹp trước khi vận chuyển.",
        file="gay-xuong-dui-3d.html",
        steps=(
            Step("Chuẩn bị dụng cụ", "Chuẩn bị dụng cụ:\n– 2 nẹp;\n– 9 dây buộc;\n– Bông, vải, giấy mềm."),
            Step("Động viên, giải thích", "Động viên, an ủi nạn nhân, người nhà và giải thích công việc sắp làm."),
            Step("Nạn nhân nằm ngửa", "Nạn nhân nằm ngửa."),
            Step(
                "Luồn và rải dây",
                "Luồn dây:\n– 2 dây qua eo lưng;\n– 5 dây qua khoeo chân;\n– 2 dây qua cổ chân.\n"
                "Rải dây:\n– 2 dây: 1 dây ngang ngực, 1 dây ngang hông.\n"
                "– 5 dây: 1 dây sát bẹn, 2 dây trên và dưới ổ gãy, 2 dây ở đầu gối.\n– 2 dây ở cổ chân.",
                substeps=("Luồn dây", "Rải dây"),
            ),
            Step(
                "Đặt nẹp",
                "Đặt nẹp:\n– 1 nẹp từ hõm nách đến quá cổ chân.\n– 1 nẹp từ nếp bẹn đến quá cổ chân.",
            ),
            Step("Đệm lót", "Đệm lót bông, vải hoặc giấy mềm ở cổ chân, đầu gối, đầu nẹp."),
            Step(
                "Buộc dây cố định",
                "Buộc dây cố định nẹp theo thứ tự:\n– 1 dây trên ổ gãy, 1 dây dưới ổ gãy;\n– 1 dây dưới khớp gối;\n"
                "– 1 dây ngang hông;\n– 1 dây ngang ngực;\n– 1 dây sát bẹn;\n– 1 dây cổ chân;\n"
                "– 2 dây cố định chi lành và chi gãy ở cổ chân và đầu gối.",
            ),
            Step("Kiểm tra lưu thông máu", "Kiểm tra lưu thông máu của chân."),
            Step("Chuyển đến cơ sở y tế", "Chuyển nạn nhân đến cơ sở y tế."),
        ),
    ),
    Guide(
        id="xuc-thia",
        title="Đưa nạn nhân lên cáng",
        method="Phương pháp xúc thìa",
        when_to_use="Cần nâng và chuyển nạn nhân (nghi chấn thương cột sống) lên cáng, có bốn người hỗ trợ.",
        file="xuc-thia-3d.html",
        steps=(
            Step("Chuẩn bị", "Chuẩn bị: cáng cứng, dây buộc, bốn người (trong đó có người chỉ huy)."),
            Step("Đánh giá và sơ cứu", "Xác định tổn thương, sơ cấp cứu tổn thương nếu có."),
            Step(
                "Vào vị trí",
                "Một người giữ đầu, ba người quỳ một phía nạn nhân, luồn hai tay tại các vị trí: dưới vai và lưng, "
                "dưới thắt lưng và dưới đùi, dưới khoeo chân và dưới cổ chân.",
            ),
            Step(
                "Nâng theo ba nấc",
                "Thực hiện theo hiệu lệnh đảm bảo nâng nạn nhân lên theo ba nấc: lên gối, úp nạn nhân vào người "
                "sơ cấp cứu và đứng thẳng. Đảm bảo đầu và cột sống nạn nhân luôn thẳng trong khi nâng lên, người "
                "giữ đầu nâng đầu nạn nhân thẳng với cột sống.",
                substeps=("Lên gối", "Úp vào người", "Đứng thẳng"),
            ),
            Step(
                "Di chuyển đến cáng",
                "Người trưởng nhóm chỉ huy nhóm đồng loạt bước đi đưa nạn nhân đến vị trí cáng hoặc xe cứu thương.",
            ),
            Step(
                "Đặt xuống cáng",
                "Đặt nạn nhân vào cáng theo hai bước ngược lại: xuống gối và xuống cáng.",
                substeps=("Xuống gối", "Xuống cáng"),
            ),
            Step(
                "Cố định nạn nhân", "Cố định nạn nhân vào cáng tại trán, cằm, vai, thắt lưng, đùi, cẳng chân, cổ chân."
            ),
        ),
    ),
)


def get_guide(guide_id: str) -> Guide:
    for guide in FIRST_AID_GUIDES:
        if guide.id == guide_id:
            return guide
    raise KeyError(f"Không có hướng dẫn {guide_id}")


@dataclass(frozen=True)
class Line:
    bullet: bool
    text: str


def step_lines(text: str) -> list[Line]:
    """Split a step into display lines (the "– " bullet marker is removed)."""
    return [Line(bullet=line.startswith("– "), text=line.removeprefix("– ")) for line in text.split("\n")]


def join_lines(lines: list[str]) -> str:
    """Join lines into one sentence so speech pauses naturally."""
    speech = ""
    for line in lines:
        trimmed = line[:-1] if line and line[-1] in ";." else line
        if not speech:
            speech = trimmed
        else:
            speech = f"{speech}{' ' if speech.endswith(':') else ', '}{trimmed}"
    return speech


def step_speech(guide: Guide, index: int) -> str:
    """Sentence the assistant reads for one step, assembled deterministically from the guide text."""
    step = guide.steps[index]
    body = join_lines([line.text for line in step_lines(step.text)])
    return f"Bước {index + 1} trên {len(guide.steps)}: {step.title}. {body}."


def guide_intro(guide: Guide) -> str:
    """Fact sent when a guide opens: the picture is on screen, the caller follows it and says "xong" after each step."""
    return (
        f"Hệ thống vừa mở hình minh họa {guide.title.lower()} theo {guide.method.lower()} trên màn hình, "
        f'gồm {len(guide.steps)} bước. Người gọi vừa nhìn hình vừa làm, xong mỗi bước thì nói "xong".'
    )
