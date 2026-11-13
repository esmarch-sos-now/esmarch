"""Course content for registered responders ("Khóa học sơ cứu").

Each lesson is one real video from the first-aid playlist of Bệnh viện Hoàn Mỹ Đà Nẵng, embedded from YouTube
unchanged and credited (see the SOURCE_* constants), followed by short key points and a quiz written by the ESMARCH
team. Content is code-reviewed and versioned with the app. Progress lives in Postgres (`course_progress`), one row per
user and lesson, keyed by lesson id, so lesson ids must be unique across all courses. The courses are closed content:
only signed-in users with a verified responder profile can read them.
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
class Video:
    youtube_id: str
    title: str  # exact title on YouTube


@dataclass(frozen=True)
class Lesson:
    id: str
    title: str
    summary: str
    minutes: int
    video: Video
    sections: tuple[Section, ...]  # "ghi nhớ": key points shown under the video
    quiz: tuple[QuizQuestion, ...]


@dataclass(frozen=True)
class Course:
    id: str
    title: str
    summary: str
    audience: str
    badge: str  # shown on the profile once every lesson is passed
    lessons: tuple[Lesson, ...]


DISCLAIMER = (
    "Nội dung chỉ để ôn tập, không thay thế khóa huấn luyện sơ cứu có chứng nhận. "
    "Trong nguy hiểm tính mạng, hãy gọi 115 trước."
)

SOURCE_NAME = "Bệnh viện Hoàn Mỹ Đà Nẵng"
SOURCE_CHANNEL_URL = "https://www.youtube.com/channel/UCShk_eb2LdmzAEbPQ1Bhq_Q"
SOURCE_PLAYLIST_URL = "https://www.youtube.com/playlist?list=PLjGhUv8IOm2gwLOaenoifb11QUiLBrA_T"
SOURCE_PLAYLIST_TITLE = "Hướng dẫn Sơ Cấp Cứu Chính xác, ngắn gọn - Bệnh viện Hoàn Mỹ Đà Nẵng"
SOURCE_NOTE = (
    "Video thuộc bản quyền của Bệnh viện Hoàn Mỹ Đà Nẵng, được nhúng nguyên vẹn từ YouTube, không chỉnh sửa. "
    "Phần ghi nhớ và câu hỏi ôn tập do nhóm ESMARCH biên soạn để giúp bạn ôn lại nội dung video."
)

AUDIENCE = "Người đã đăng ký làm người hỗ trợ"

COURSES: tuple[Course, ...] = (
    Course(
        id="airway-choking",
        title="Xử trí hóc dị vật đường thở",
        summary=(
            "Ba video ngắn của Bệnh viện Hoàn Mỹ Đà Nẵng: xử trí hóc dị vật cho người còn tỉnh, "
            "tự xử trí khi bị hóc một mình và xử trí sặc sữa ở trẻ nhỏ."
        ),
        audience=AUDIENCE,
        badge="Hoàn thành khóa Xử trí hóc dị vật đường thở",
        lessons=(
            Lesson(
                id="choking-conscious",
                title="Hóc dị vật ở người lớn còn tỉnh",
                summary="Nhận biết tắc nghẽn đường thở, luân phiên vỗ lưng và ép bụng đúng cách.",
                minutes=5,
                video=Video(
                    youtube_id="EY1HGIfAgBs",
                    title=(
                        "[Hướng dẫn sơ cấp cứu] Xử trí dị vật đường thở cho nạn nhân tỉnh táo"
                        " - Bệnh viện Hoàn Mỹ Đà Nẵng"
                    ),
                ),
                sections=(
                    Section(
                        heading="Nhận biết",
                        paragraphs=(
                            "Nạn nhân có thể ôm cổ, không nói được, không ho được hoặc khó thở. "
                            "Nếu vẫn ho mạnh được, hãy khuyến khích ho và theo dõi.",
                        ),
                    ),
                    Section(
                        heading="Vỗ lưng và ép bụng",
                        bullets=(
                            "Gọi 115 hoặc nhờ người khác gọi ngay.",
                            "Đứng sau lưng, đỡ ngực cho nạn nhân cúi về trước, "
                            "vỗ 5 lần bằng gót bàn tay vào giữa hai bả vai.",
                            "Ép bụng 5 lần: nắm tay đặt trên rốn, dưới xương ức, tay kia ôm lấy nắm tay, "
                            "kéo mạnh vào trong và lên trên.",
                            "Luân phiên 5 vỗ lưng và 5 ép bụng cho tới khi dị vật ra hoặc nạn nhân bất tỉnh.",
                        ),
                    ),
                    Section(
                        heading="Lưu ý",
                        bullets=(
                            "Phụ nữ mang thai hoặc người béo phì: thay ép bụng bằng ép ngực.",
                            "Nạn nhân bất tỉnh: đặt nằm ngửa trên nền cứng và bắt đầu CPR.",
                            "Không dùng ngón tay móc họng khi không nhìn thấy dị vật.",
                        ),
                    ),
                ),
                quiz=(
                    QuizQuestion(
                        id="choking-conscious-q1",
                        question="Nạn nhân hóc dị vật nhưng vẫn ho mạnh được. Bạn nên làm gì?",
                        options=(
                            "Ép bụng ngay lập tức",
                            "Khuyến khích nạn nhân tiếp tục ho và theo dõi",
                            "Cho nạn nhân uống thật nhiều nước",
                        ),
                        answer=1,
                        explanation="Ho mạnh giúp đẩy dị vật ra; chỉ can thiệp khi ho yếu dần hoặc không thở được.",
                    ),
                    QuizQuestion(
                        id="choking-conscious-q2",
                        question="Khi ép bụng cho người lớn, đặt nắm tay ở đâu?",
                        options=("Trên xương ức", "Dưới rốn", "Trên rốn, dưới xương ức"),
                        answer=2,
                        explanation="Nắm tay đặt trên rốn, dưới xương ức rồi kéo mạnh vào trong và lên trên.",
                    ),
                    QuizQuestion(
                        id="choking-conscious-q3",
                        question="Với phụ nữ đang mang thai bị hóc dị vật, nên thay ép bụng bằng gì?",
                        options=("Ép ngực", "Vỗ lưng mạnh hơn", "Dốc ngược nạn nhân"),
                        answer=0,
                        explanation="Ép ngực tránh gây tổn thương vùng bụng và thai nhi.",
                    ),
                ),
            ),
            Lesson(
                id="choking-self",
                title="Tự xử trí khi bị hóc một mình",
                summary=(
                    "Khi không có ai bên cạnh, bạn vẫn có thể tự ép bụng hoặc tì bụng vào lưng ghế để đẩy dị vật ra."
                ),
                minutes=4,
                video=Video(
                    youtube_id="oVyBVKdlYNU",
                    title=(
                        "[Hướng dẫn sơ cấp cứu] Tự Xử Trí Dị Vật Đường Thở Cho Bản Thân | Bệnh viện Hoàn Mỹ Đà Nẵng"
                    ),
                ),
                sections=(
                    Section(
                        heading="Tự ép bụng",
                        bullets=(
                            "Gọi 115 hoặc ra hiệu cho người xung quanh nếu còn làm được.",
                            "Nắm một tay, đặt phía trên rốn, dưới xương ức; tay kia ôm lấy nắm tay.",
                            "Ấn mạnh và nhanh vào trong, hướng lên trên; lặp lại cho tới khi dị vật bật ra.",
                        ),
                    ),
                    Section(
                        heading="Dùng lưng ghế hoặc mép bàn",
                        bullets=(
                            "Cúi người, tì vùng bụng trên (trên rốn) vào lưng ghế chắc chắn hoặc mép bàn.",
                            "Dồn mạnh trọng lượng cơ thể xuống để tạo lực ép, lặp lại nhiều lần.",
                            "Sau khi dị vật ra, vẫn nên đi khám để kiểm tra tổn thương.",
                        ),
                    ),
                ),
                quiz=(
                    QuizQuestion(
                        id="choking-self-q1",
                        question="Khi tự ép bụng, bạn đặt nắm tay ở đâu?",
                        options=("Dưới rốn", "Ngay trên xương ức", "Trên rốn, dưới xương ức"),
                        answer=2,
                        explanation="Vị trí giống như khi ép bụng cho người khác: trên rốn, dưới xương ức.",
                    ),
                    QuizQuestion(
                        id="choking-self-q2",
                        question="Bị hóc khi ở một mình, ngoài tự ép bằng tay bạn có thể làm gì?",
                        options=(
                            "Tì mạnh bụng trên vào lưng ghế hoặc mép bàn",
                            "Nằm ngửa và chờ dị vật tự trôi",
                            "Uống nước để đẩy dị vật xuống",
                        ),
                        answer=0,
                        explanation="Lưng ghế hoặc mép bàn giúp tạo lực ép bụng mạnh khi không có người giúp.",
                    ),
                    QuizQuestion(
                        id="choking-self-q3",
                        question="Lực ép bụng cần hướng theo chiều nào?",
                        options=("Thẳng xuống dưới", "Vào trong và lên trên", "Sang hai bên"),
                        answer=1,
                        explanation="Ép vào trong và lên trên đẩy không khí trong phổi ra, tống dị vật khỏi đường thở.",
                    ),
                ),
            ),
            Lesson(
                id="infant-milk-aspiration",
                title="Sặc sữa và hóc dị vật ở trẻ dưới 1 tuổi",
                summary="Vỗ lưng và ấn ngực đúng tư thế cho trẻ nhỏ; không ép bụng ở trẻ dưới 1 tuổi.",
                minutes=5,
                video=Video(
                    youtube_id="_ArYhTpP32s",
                    title="[Hướng dẫn sơ cấp cứu] Xử Trí Sặc Sữa Ở Trẻ Nhỏ - Bệnh viện Hoàn Mỹ Đà Nẵng",
                ),
                sections=(
                    Section(
                        heading="Vỗ lưng và ấn ngực",
                        bullets=(
                            "Đặt trẻ nằm sấp dọc theo cẳng tay, đầu thấp hơn thân, bàn tay đỡ lấy hàm trẻ.",
                            "Dùng gót bàn tay vỗ 5 lần vào giữa hai bả vai.",
                            "Lật trẻ nằm ngửa, đầu vẫn thấp; dùng 2 ngón tay ấn 5 lần vào giữa ngực, "
                            "ngay dưới đường nối hai núm vú.",
                            "Lặp lại 5 vỗ lưng và 5 ấn ngực cho tới khi trẻ khóc, ho hoặc thở lại được.",
                        ),
                    ),
                    Section(
                        heading="Lưu ý",
                        bullets=(
                            "Không ép bụng ở trẻ dưới 1 tuổi.",
                            "Nếu trẻ lả đi, không phản ứng: gọi 115 và bắt đầu CPR cho trẻ nhũ nhi.",
                        ),
                    ),
                    Section(
                        heading="Phòng ngừa sặc sữa",
                        bullets=(
                            "Cho trẻ ợ hơi sau mỗi cữ bú.",
                            "Không cho trẻ bú khi đang nằm thẳng.",
                        ),
                    ),
                ),
                quiz=(
                    QuizQuestion(
                        id="infant-milk-aspiration-q1",
                        question="Khi vỗ lưng cho trẻ dưới 1 tuổi bị sặc, đặt trẻ ở tư thế nào?",
                        options=(
                            "Nằm ngửa trên giường",
                            "Nằm sấp dọc cẳng tay, đầu thấp hơn thân",
                            "Bế đứng, đầu cao hơn thân",
                        ),
                        answer=1,
                        explanation="Đầu thấp hơn thân giúp dị vật hoặc sữa dễ thoát ra ngoài.",
                    ),
                    QuizQuestion(
                        id="infant-milk-aspiration-q2",
                        question="Ấn ngực cho trẻ nhũ nhi như thế nào?",
                        options=(
                            "2 ngón tay ấn giữa ngực, ngay dưới đường nối hai núm vú",
                            "Cả bàn tay ấn lên bụng trẻ",
                            "Gót bàn tay ấn lên xương ức như người lớn",
                        ),
                        answer=0,
                        explanation="Trẻ nhỏ chỉ cần lực của 2 ngón tay, đặt giữa ngực ngay dưới đường nối hai núm vú.",
                    ),
                    QuizQuestion(
                        id="infant-milk-aspiration-q3",
                        question="Với trẻ dưới 1 tuổi bị hóc, việc nào KHÔNG nên làm?",
                        options=(
                            "Vỗ lưng 5 lần giữa hai bả vai",
                            "Gọi 115 nếu trẻ không còn phản ứng",
                            "Ép bụng như với người lớn",
                        ),
                        answer=2,
                        explanation="Ép bụng có thể làm tổn thương gan và nội tạng của trẻ nhỏ.",
                    ),
                ),
            ),
        ),
    ),
    Course(
        id="breathing-bleeding-fainting",
        title="Hô hấp nhân tạo, cầm máu và sơ cứu ngất",
        summary=(
            "Ba video ngắn của Bệnh viện Hoàn Mỹ Đà Nẵng: hô hấp nhân tạo cho người lớn, "
            "sơ cứu vết thương chảy máu và sơ cứu choáng ngất."
        ),
        audience=AUDIENCE,
        badge="Hoàn thành khóa Hô hấp nhân tạo, cầm máu và sơ cứu ngất",
        lessons=(
            Lesson(
                id="rescue-breathing",
                title="Hô hấp nhân tạo cho người lớn",
                summary="Khai thông đường thở, thổi ngạt đúng cách và phối hợp 30 lần ép ngực với 2 lần thổi.",
                minutes=6,
                video=Video(
                    youtube_id="Ei1UsHqtUvo",
                    title="[Hướng dẫn sơ cấp cứu] Hô Hấp Nhân Tạo Cho Người Lớn - Bệnh viện Hoàn Mỹ Đà Nẵng",
                ),
                sections=(
                    Section(
                        heading="Hành động ngay",
                        paragraphs=(
                            "Não có thể bắt đầu tổn thương sau khoảng 4–6 phút thiếu oxy. Khi nạn nhân không phản ứng "
                            "và không thở bình thường, gọi 115, nhờ người lấy AED và bắt đầu cấp cứu ngay.",
                        ),
                    ),
                    Section(
                        heading="Thổi ngạt",
                        bullets=(
                            "Ngửa đầu, nâng cằm để khai thông đường thở.",
                            "Bịt mũi nạn nhân, áp kín miệng mình lên miệng nạn nhân.",
                            "Thổi 2 lần, mỗi lần khoảng 1 giây, nhìn thấy lồng ngực nhô lên.",
                        ),
                    ),
                    Section(
                        heading="Phối hợp với ép ngực",
                        bullets=(
                            "30 lần ép ngực (sâu 5–6 cm, 100–120 lần/phút) rồi 2 lần thổi, lặp lại liên tục.",
                            "Chưa được huấn luyện hoặc không muốn thổi ngạt: ép ngực liên tục.",
                        ),
                    ),
                ),
                quiz=(
                    QuizQuestion(
                        id="rescue-breathing-q1",
                        question="Trước khi thổi ngạt, làm sao để khai thông đường thở?",
                        options=("Ngửa đầu, nâng cằm", "Kê gối cao dưới đầu", "Cúi đầu nạn nhân về trước"),
                        answer=0,
                        explanation="Ngửa đầu, nâng cằm kéo lưỡi ra khỏi thành họng để không khí đi vào phổi.",
                    ),
                    QuizQuestion(
                        id="rescue-breathing-q2",
                        question="Tỉ lệ ép ngực và thổi ngạt cho người lớn là bao nhiêu?",
                        options=("15 lần ép : 1 lần thổi", "30 lần ép : 2 lần thổi", "5 lần ép : 5 lần thổi"),
                        answer=1,
                        explanation="Chu kỳ 30 : 2 được áp dụng cho người lớn, kể cả khi chỉ có một người cứu.",
                    ),
                    QuizQuestion(
                        id="rescue-breathing-q3",
                        question="Mỗi lần thổi ngạt nên kéo dài bao lâu?",
                        options=(
                            "Thổi thật mạnh và lâu nhất có thể",
                            "Thổi liên tục, không cần quan sát",
                            "Khoảng 1 giây, đủ thấy lồng ngực nhô lên",
                        ),
                        answer=2,
                        explanation="Thổi quá mạnh đẩy khí vào dạ dày; chỉ cần đủ để lồng ngực nhô lên.",
                    ),
                ),
            ),
            Lesson(
                id="bleeding-wounds",
                title="Sơ cứu vết thương chảy máu",
                summary="Phân biệt chảy máu tĩnh mạch và động mạch, ép trực tiếp để cầm máu và biết khi nào cần garô.",
                minutes=5,
                video=Video(
                    youtube_id="6a3ge4UD4Lc",
                    title="[Hướng dẫn sơ cấp cứu] Sơ Cứu Vết Thương Chảy Máu - Bệnh viện Hoàn Mỹ Đà Nẵng",
                ),
                sections=(
                    Section(
                        heading="Nhận biết",
                        bullets=(
                            "Máu tĩnh mạch: đỏ sẫm, chảy đều và liên tục.",
                            "Máu động mạch: đỏ tươi, phun thành tia theo nhịp mạch, nguy hiểm hơn.",
                        ),
                    ),
                    Section(
                        heading="Ép trực tiếp",
                        bullets=(
                            "Đeo găng hoặc dùng lớp vải sạch, ấn chặt trực tiếp lên vết thương liên tục.",
                            "Nếu máu thấm qua, chồng thêm lớp gạc mới; không bóc lớp đang ép.",
                            "Nâng cao chi bị thương nếu không nghi gãy xương.",
                        ),
                    ),
                    Section(
                        heading="Chảy máu nặng",
                        bullets=(
                            "Gọi 115 nếu máu chảy nhiều, nạn nhân tái lạnh hoặc lơ mơ.",
                            "Chỉ dùng garô khi chảy máu ở tay chân đe dọa tính mạng mà ép trực tiếp không cầm được; "
                            "ghi lại thời điểm đặt garô.",
                            "Giữ nạn nhân ấm và nằm yên trong khi chờ trợ giúp.",
                        ),
                    ),
                ),
                quiz=(
                    QuizQuestion(
                        id="bleeding-wounds-q1",
                        question="Máu chảy từ động mạch có đặc điểm gì?",
                        options=(
                            "Đỏ sẫm, rỉ ra chậm",
                            "Đỏ tươi, phun thành tia theo nhịp mạch",
                            "Chảy rất ít rồi tự ngừng",
                        ),
                        answer=1,
                        explanation="Máu động mạch đỏ tươi và phun theo nhịp tim nên mất máu rất nhanh.",
                    ),
                    QuizQuestion(
                        id="bleeding-wounds-q2",
                        question="Đang ép trực tiếp vết thương mà máu thấm qua lớp gạc, bạn nên làm gì?",
                        options=(
                            "Bóc lớp gạc cũ ra rồi thay lớp mới",
                            "Rửa vết thương bằng nước",
                            "Chồng thêm lớp gạc mới và tiếp tục ép",
                        ),
                        answer=2,
                        explanation="Bóc lớp cũ làm bong cục máu đông; chồng thêm lớp mới để tiếp tục cầm máu.",
                    ),
                    QuizQuestion(
                        id="bleeding-wounds-q3",
                        question="Khi nào nên dùng garô?",
                        options=(
                            "Chảy máu ở tay chân đe dọa tính mạng mà ép trực tiếp không cầm được",
                            "Với mọi vết thương chảy máu",
                            "Khi vết thương nhỏ nhưng đau nhiều",
                        ),
                        answer=0,
                        explanation="Garô là biện pháp cuối cùng; nhớ ghi lại thời điểm đặt để báo cho nhân viên y tế.",
                    ),
                ),
            ),
            Lesson(
                id="fainting",
                title="Sơ cứu choáng ngất",
                summary="Nhận biết dấu hiệu sắp ngất, đặt nạn nhân nằm kê cao chân và biết khi nào cần gọi 115.",
                minutes=4,
                video=Video(
                    youtube_id="jNi1nCk_sNc",
                    title="[Hướng dẫn sơ cấp cứu] Sơ Cứu Choáng Ngất - Bệnh viện Hoàn Mỹ Đà Nẵng",
                ),
                sections=(
                    Section(
                        heading="Dấu hiệu báo trước",
                        paragraphs=(
                            "Chóng mặt, da tái, vã mồ hôi, nhìn mờ, buồn nôn. "
                            "Khi thấy các dấu hiệu này, giúp người đó ngồi hoặc nằm xuống ngay để tránh ngã.",
                        ),
                    ),
                    Section(
                        heading="Khi nạn nhân ngất",
                        bullets=(
                            "Đặt nằm ngửa, kê cao chân khoảng 20–30 cm.",
                            "Nới lỏng quần áo chật như cổ áo, thắt lưng.",
                            "Giữ nơi thoáng khí, không để người xung quanh vây kín.",
                        ),
                    ),
                    Section(
                        heading="Khi nào gọi 115",
                        bullets=(
                            "Không tỉnh lại sau khoảng 1 phút: gọi 115 và kiểm tra hơi thở.",
                            "Không thở bình thường: bắt đầu CPR ngay.",
                            "Không cho ăn uống cho tới khi nạn nhân tỉnh táo hoàn toàn.",
                        ),
                    ),
                ),
                quiz=(
                    QuizQuestion(
                        id="fainting-q1",
                        question="Người vừa ngất và vẫn thở bình thường. Nên đặt nạn nhân thế nào?",
                        options=(
                            "Ngồi dựa tường, cúi đầu xuống",
                            "Đỡ dậy đi lại cho tỉnh",
                            "Nằm ngửa, kê cao chân khoảng 20–30 cm",
                        ),
                        answer=2,
                        explanation="Kê cao chân giúp máu về tim và não nhiều hơn.",
                    ),
                    QuizQuestion(
                        id="fainting-q2",
                        question="Nạn nhân không tỉnh lại sau khoảng 1 phút. Bạn nên làm gì?",
                        options=(
                            "Gọi 115, kiểm tra hơi thở và bắt đầu CPR nếu không thở bình thường",
                            "Tạt nước lạnh vào mặt rồi chờ thêm",
                            "Cho nạn nhân uống nước đường",
                        ),
                        answer=0,
                        explanation="Ngất kéo dài có thể là dấu hiệu bệnh nặng hoặc ngừng tim, cần cấp cứu ngay.",
                    ),
                    QuizQuestion(
                        id="fainting-q3",
                        question="Khi nào có thể cho người vừa ngất ăn uống?",
                        options=(
                            "Ngay khi nạn nhân mở mắt",
                            "Khi nạn nhân đã tỉnh táo hoàn toàn",
                            "Trong lúc còn lơ mơ để lấy lại sức",
                        ),
                        answer=1,
                        explanation="Cho ăn uống khi còn lơ mơ có thể gây sặc vào đường thở.",
                    ),
                ),
            ),
        ),
    ),
)
