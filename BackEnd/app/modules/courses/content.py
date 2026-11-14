"""Course content for registered responders ("Khóa học sơ cứu").

Each lesson is one real video from the first-aid playlist of Bệnh viện Hoàn Mỹ Đà Nẵng, embedded from YouTube
unchanged and credited (see the SOURCE_* constants), followed by short key points written by the ESMARCH team and a
quiz generated per attempt from the first-aid spreadsheet (`question_bank.py`, `quiz.py`): `bank_topics` lists the
rows ("STT") of the sheet a lesson's questions are drawn from. Content is code-reviewed and versioned with the app.
Progress lives in Postgres (`course_progress`), one row per user and lesson, keyed by lesson id, so lesson ids must be
unique across all courses. The courses are closed content: only signed-in users with a verified responder profile can
read them.
"""

from dataclasses import dataclass


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
    bank_topics: tuple[int, ...]  # "STT" of the spreadsheet rows the quiz is generated from


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
    "Phần ghi nhớ do nhóm ESMARCH biên soạn; câu hỏi ôn tập được tạo ngẫu nhiên từ tài liệu sơ cứu của nhóm."
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
                bank_topics=(13, 14, 15, 16),
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
                bank_topics=(13, 15, 16),
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
                bank_topics=(13, 20, 21, 22),
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
                bank_topics=(23, 26, 64),
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
                bank_topics=(27, 28, 29, 33),
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
                bank_topics=(23, 30, 139),
            ),
        ),
    ),
)
