"""Course content for registered responders ("Khóa học sơ cứu").

Content is code-reviewed and versioned with the app. Progress lives in Postgres (`course_progress`), one row per
user and lesson. The course is closed content: only signed-in users with a verified responder profile can read it.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class QuizQuestion:
    id: str
    question: str
    options: tuple[str, ...]
    answer: int
    explanation: str


@dataclass(frozen=True)
class Section:
    heading: str
    paragraphs: tuple[str, ...] = ()
    bullets: tuple[str, ...] = ()


@dataclass(frozen=True)
class Lesson:
    id: str
    title: str
    summary: str
    minutes: int
    sections: tuple[Section, ...]
    quiz: tuple[QuizQuestion, ...]


@dataclass(frozen=True)
class Course:
    id: str
    title: str
    summary: str
    audience: str
    lessons: tuple[Lesson, ...]


DISCLAIMER = (
    "Nội dung chỉ để ôn tập, không thay thế khóa huấn luyện sơ cứu có chứng nhận. "
    "Trong nguy hiểm tính mạng, hãy gọi 115 trước."
)

COURSES: tuple[Course, ...] = (
    Course(
        id="first-aid-basics",
        title="Sơ cứu cơ bản cho người hỗ trợ",
        summary=(
            "Bốn bài ngắn giúp bạn bình tĩnh xử lý tình huống khẩn cấp: giữ an toàn, gọi trợ giúp, "
            "CPR, hóc dị vật, đột quỵ và chảy máu nặng."
        ),
        audience="Người đã đăng ký làm người hỗ trợ",
        lessons=(
            Lesson(
                id="scene-safety",
                title="An toàn hiện trường và gọi trợ giúp",
                summary="Quan sát trước khi tiếp cận, gọi 115 đúng thông tin và kiểm tra phản ứng của nạn nhân.",
                minutes=4,
                sections=(
                    Section(
                        heading="Trước khi tiếp cận",
                        paragraphs=(
                            "Bạn không thể giúp ai nếu chính mình gặp nạn. Hãy dừng lại vài giây để nhìn quanh.",
                        ),
                        bullets=(
                            "Quan sát dây điện, xe cộ, lửa, khói, vật sắc nhọn hoặc nguy cơ sập đổ.",
                            "Chỉ tiếp cận khi hiện trường an toàn. Nếu không, giữ khoảng cách và gọi 115.",
                            "Đeo găng tay hoặc dùng túi ni lông sạch để hạn chế tiếp xúc với máu.",
                        ),
                    ),
                    Section(
                        heading="Gọi 115 sớm",
                        paragraphs=(
                            "Gọi càng sớm càng tốt. Nói rõ vị trí, số người bị nạn và tình trạng hiện tại; "
                            "làm theo hướng dẫn của tổng đài và không cúp máy trước khi được phép.",
                        ),
                        bullets=(
                            "Nhờ người xung quanh lấy máy AED gần nhất nếu có.",
                            "Cử một người đứng ở đầu đường để dẫn xe cấp cứu vào.",
                        ),
                    ),
                    Section(
                        heading="Kiểm tra phản ứng và hơi thở",
                        paragraphs=(
                            "Gọi lớn và vỗ nhẹ vào vai nạn nhân. Nếu nạn nhân không phản ứng và không thở bình thường, "
                            "hãy bắt đầu CPR ngay và nhờ người khác gọi 115.",
                        ),
                    ),
                ),
                quiz=(
                    QuizQuestion(
                        id="scene-q1",
                        question="Việc đầu tiên bạn nên làm khi chứng kiến một tai nạn là gì?",
                        options=(
                            "Chạy tới kéo nạn nhân ra khỏi hiện trường",
                            "Quan sát và bảo đảm an toàn cho bản thân trước",
                            "Cho nạn nhân uống nước",
                        ),
                        answer=1,
                        explanation="An toàn của người cứu là điều kiện để giúp được nạn nhân.",
                    ),
                    QuizQuestion(
                        id="scene-q2",
                        question="Khi gọi 115, thông tin nào quan trọng nhất?",
                        options=(
                            "Vị trí chính xác và tình trạng nạn nhân",
                            "Tên đầy đủ của bạn",
                            "Nghề nghiệp của nạn nhân",
                        ),
                        answer=0,
                        explanation="Vị trí và tình trạng giúp điều phối viên chọn đúng hỗ trợ.",
                    ),
                ),
            ),
            Lesson(
                id="cpr",
                title="CPR cho người lớn",
                summary="Ép ngực đúng tốc độ và độ sâu, phối hợp với AED khi có.",
                minutes=8,
                sections=(
                    Section(
                        heading="Xác định có cần CPR không",
                        paragraphs=(
                            "Chỉ bắt đầu CPR khi nạn nhân không phản ứng và không thở bình thường "
                            "(hoặc chỉ thở ngáp). Đặt nạn nhân nằm ngửa trên mặt phẳng cứng.",
                        ),
                    ),
                    Section(
                        heading="Ép ngực đúng cách",
                        bullets=(
                            "Đặt gót bàn tay giữa ngực, chồng bàn tay còn lại lên trên, các ngón đan vào nhau.",
                            "Giữ khuỷu tay thẳng, dùng trọng lượng cơ thể để ép xuống.",
                            "Ép sâu 5–6 cm với người lớn, tốc độ 100–120 lần mỗi phút.",
                            "Để ngực nở hoàn toàn giữa các lần ép; hạn chế gián đoạn.",
                        ),
                    ),
                    Section(
                        heading="Chu kỳ 30 : 2",
                        paragraphs=(
                            "Nếu đã được huấn luyện, thực hiện 30 lần ép ngực và 2 lần thổi ngạt, lặp lại. "
                            "Nếu không được huấn luyện hoặc không muốn thổi ngạt, hãy ép ngực liên tục.",
                        ),
                    ),
                    Section(
                        heading="Dùng AED",
                        paragraphs=(
                            "Bật máy và làm theo hướng dẫn bằng giọng nói. "
                            "Dán điện cực lên ngực trần theo hình trên máy. "
                            "Không chạm vào nạn nhân khi máy đang phân tích hoặc phát sốc.",
                        ),
                    ),
                ),
                quiz=(
                    QuizQuestion(
                        id="cpr-q1",
                        question="Tốc độ ép ngực khuyến nghị cho người lớn là bao nhiêu?",
                        options=("40–60 lần/phút", "70–80 lần/phút", "100–120 lần/phút"),
                        answer=2,
                        explanation="Ép ngực mạnh và nhanh 100–120 lần/phút giúp duy trì tuần hoàn.",
                    ),
                    QuizQuestion(
                        id="cpr-q2",
                        question="Độ sâu ép ngực phù hợp với người lớn là bao nhiêu?",
                        options=("2–3 cm", "5–6 cm", "8–10 cm"),
                        answer=1,
                        explanation="Ép sâu 5–6 cm, sau đó để ngực nở hoàn toàn.",
                    ),
                    QuizQuestion(
                        id="cpr-q3",
                        question="Khi nào nên dùng AED?",
                        options=(
                            "Ngay khi có máy và nạn nhân không phản ứng, không thở bình thường",
                            "Chỉ khi nạn nhân đã tỉnh lại",
                            "Sau khi chờ xe cấp cứu đến",
                        ),
                        answer=0,
                        explanation="AED càng được dùng sớm, cơ hội sống sót càng cao.",
                    ),
                ),
            ),
            Lesson(
                id="choking",
                title="Hóc dị vật ở người lớn",
                summary="Nhận biết tắc nghẽn đường thở, vỗ lưng và ép bụng đúng cách.",
                minutes=5,
                sections=(
                    Section(
                        heading="Nhận biết",
                        paragraphs=(
                            "Nạn nhân có thể ôm cổ, không nói được, không ho được hoặc khó thở. "
                            "Nếu vẫn ho mạnh được, hãy khuyến khích ho và theo dõi.",
                        ),
                    ),
                    Section(
                        heading="Tắc nghẽn nặng",
                        bullets=(
                            "Gọi 115 hoặc nhờ người khác gọi ngay.",
                            "Đứng sau lưng, đặt một tay lên ngực và nghiêng người nạn nhân về trước.",
                            "Vỗ 5 lần bằng gót bàn tay vào giữa hai bả vai.",
                            "Nếu chưa thông, thực hiện 5 lần ép bụng: nắm tay đặt trên rốn, "
                            "dưới xương ức, kéo mạnh vào trong và lên trên.",
                            "Luân phiên 5 vỗ lưng và 5 ép bụng cho tới khi dị vật ra hoặc nạn nhân bất tỉnh.",
                        ),
                    ),
                    Section(
                        heading="Khi nạn nhân bất tỉnh",
                        paragraphs=(
                            "Đặt nạn nhân xuống nền an toàn và bắt đầu CPR. "
                            "Không dùng tay móc họng nếu không nhìn thấy dị vật.",
                        ),
                    ),
                    Section(
                        heading="Người béo phì hoặc đang mang thai",
                        paragraphs=(
                            "Thay ép bụng bằng ép ngực: đặt tay giữa ngực và ép mạnh tương tự CPR.",
                        ),
                    ),
                ),
                quiz=(
                    QuizQuestion(
                        id="choking-q1",
                        question="Nạn nhân hóc dị vật nhưng vẫn ho mạnh. Bạn nên làm gì?",
                        options=(
                            "Khuyến khích nạn nhân tiếp tục ho",
                            "Ép bụng ngay lập tức",
                            "Cho nạn nhân uống nước thật nhiều",
                        ),
                        answer=0,
                        explanation="Ho mạnh giúp đẩy dị vật ra; chỉ can thiệp khi ho yếu hoặc không thở được.",
                    ),
                    QuizQuestion(
                        id="choking-q2",
                        question="Vị trí đặt tay khi ép bụng (Heimlich) ở người lớn?",
                        options=(
                            "Trên xương ức",
                            "Dưới rốn",
                            "Trên rốn, dưới xương ức",
                        ),
                        answer=2,
                        explanation="Nắm tay đặt trên rốn, dưới xương ức rồi kéo vào trong và lên trên.",
                    ),
                    QuizQuestion(
                        id="choking-q3",
                        question="Với phụ nữ đang mang thai bị hóc dị vật, nên thay ép bụng bằng gì?",
                        options=("Ép ngực", "Vỗ lưng mạnh hơn", "Dốc ngược nạn nhân"),
                        answer=0,
                        explanation="Ép ngực tránh gây tổn thương vùng bụng và thai nhi.",
                    ),
                ),
            ),
            Lesson(
                id="stroke-bleeding",
                title="Đột quỵ và chảy máu nặng",
                summary="Nhận diện đột quỵ bằng FAST và cầm máu bằng ép trực tiếp.",
                minutes=7,
                sections=(
                    Section(
                        heading="Nhận biết đột quỵ bằng FAST",
                        bullets=(
                            "F — Face: yêu cầu cười, xem một bên mặt có xệ xuống không.",
                            "A — Arms: yêu cầu giơ hai tay, xem một tay có rơi xuống không.",
                            "S — Speech: yêu cầu nói một câu đơn giản, nghe xem có khó nói hoặc lẫn không.",
                            "T — Time: ghi lại thời điểm khởi phát và gọi 115 ngay.",
                        ),
                    ),
                    Section(
                        heading="Trong khi chờ cấp cứu",
                        paragraphs=(
                            "Không cho nạn nhân ăn, uống hoặc tự dùng thuốc. "
                            "Nếu nạn nhân nôn, đặt nằm nghiêng an toàn. "
                            "Không tự lái xe đưa nạn nhân đi cấp cứu.",
                        ),
                    ),
                    Section(
                        heading="Cầm máu vết thương nặng",
                        bullets=(
                            "Đeo găng hoặc dùng lớp vải sạch, ấn trực tiếp lên vết thương liên tục.",
                            "Nếu máu thấm qua, chồng thêm lớp gạc mới; không bóc lớp đang ép.",
                            "Gọi 115 nếu máu chảy nhiều, nạn nhân tái lạnh hoặc lơ mơ.",
                            "Giữ nạn nhân ấm và yên, không cho ăn uống khi chờ trợ giúp.",
                        ),
                    ),
                ),
                quiz=(
                    QuizQuestion(
                        id="stroke-q1",
                        question="Trong quy tắc FAST, chữ T nhắc bạn làm gì?",
                        options=(
                            "Ghi thời điểm khởi phát và gọi 115",
                            "Đo thân nhiệt",
                            "Cho nạn nhân dùng thuốc ngay",
                        ),
                        answer=0,
                        explanation="Thời điểm khởi phát rất quan trọng với điều trị đột quỵ.",
                    ),
                    QuizQuestion(
                        id="stroke-q2",
                        question="Đang ép trực tiếp vết thương mà máu thấm qua lớp gạc, bạn nên làm gì?",
                        options=(
                            "Bóc lớp gạc cũ ra rồi thay lớp mới",
                            "Chồng thêm lớp gạc mới và tiếp tục ép",
                            "Rửa vết thương bằng nước",
                        ),
                        answer=1,
                        explanation="Chồng thêm lớp mới giúp giữ cục máu đông và tiếp tục cầm máu.",
                    ),
                ),
            ),
        ),
    ),
)
