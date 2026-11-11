// Nội dung bài luyện tránh đột quỵ. Chỉ là ôn tập, không phải chẩn đoán.

export type QuizQuestion = {
  question: string
  options: string[]
  answer: number
}

export const strokePractice = {
  title: 'Luyện tập tránh đột quỵ',
  lede: 'Ôn thói quen phòng ngừa, nhận dấu hiệu FAST, rồi thử thao tác trước camera. Bài này giúp bạn nhớ việc cần làm. Nó không kết luận bạn có bị đột quỵ hay không.',
  prevention: {
    label: 'Phòng ngừa',
    title: 'Thói quen giảm nguy cơ',
    intro: 'Đột quỵ thường đi cùng huyết áp cao, thuốc lá, ít vận động và ăn mặn. Đánh dấu việc bạn đang giữ. Danh sách chỉ lưu trên trình duyệt này.',
    risks: [
      { title: 'Huyết áp cao', text: 'Huyết áp tăng lâu ngày làm yếu mạch máu não. Hãy đo định kỳ và hỏi bác sĩ nếu chỉ số cao.' },
      { title: 'Thuốc lá', text: 'Khói thuốc làm mạch máu dễ tổn thương. Bỏ thuốc là một cách giảm nguy cơ rõ nhất.' },
      { title: 'Ít vận động', text: 'Ngồi nhiều đi cùng thừa cân và huyết áp cao. Đi bộ phần lớn các ngày trong tuần đã có ích.' },
      { title: 'Ăn mặn', text: 'Muối kéo huyết áp lên. Bớt nước chấm, đồ hộp và đồ ăn sẵn.' }
    ],
    habits: [
      { id: 'bp', label: 'Đo huyết áp và uống thuốc đúng chỉ định của bác sĩ' },
      { id: 'move', label: 'Đi bộ hoặc vận động nhẹ hầu hết các ngày' },
      { id: 'salt', label: 'Ăn nhạt hơn và không hút thuốc' },
      { id: 'rest', label: 'Ngủ đủ và hạn chế rượu bia' }
    ],
    progress: (done: number, total: number) => `Đã chọn ${done}/${total} thói quen`
  },
  fast: {
    label: 'Nhận biết',
    title: 'FAST — việc cần làm ngay',
    intro: 'Khi một bên mặt xệ, một tay yếu hoặc nói khó xuất hiện đột ngột, ghi lại giờ và gọi 115. Không chờ xem có tự khỏi.',
    steps: [
      { letter: 'F', title: 'Face — Mặt', text: 'Nhờ người đó cười. Quan sát một bên mặt hoặc khóe miệng có xệ xuống không.' },
      { letter: 'A', title: 'Arms — Tay', text: 'Nhờ giơ hai tay về phía trước và giữ. Một tay có rơi xuống không.' },
      { letter: 'S', title: 'Speech — Lời nói', text: 'Nhờ nhắc một câu đơn giản. Nghe xem có nói khó, lẫn hoặc không nói được không.' },
      { letter: 'T', title: 'Time — Thời gian', text: 'Ghi lúc triệu chứng bắt đầu và gọi 115 ngay. Không tự lái xe đến bệnh viện.' }
    ],
    avoid: 'Không cho ăn, uống hoặc tự dùng thuốc trong khi chờ trợ giúp.',
    sos: 'Mở nút SOS',
    call: 'Gọi 115'
  },
  camera: {
    label: 'Trước camera',
    title: 'Luyện thao tác FAST',
    intro: 'Bấm bắt đầu để mở camera, đếm ngược, rồi lần lượt cười, giơ hai tay và nói một câu. Hình và giọng nói được xử lý trên máy bạn, không gửi lên máy chủ. Lần đầu trình duyệt có thể tải mô hình nhận diện về máy.',
    start: 'Bắt đầu bài luyện',
    again: 'Làm lại',
    preparing: 'Đang mở camera và chuẩn bị nhận diện…',
    countdown: 'Chuẩn bị',
    facePrompt: 'Nhìn thẳng camera và cười.',
    armsPrompt: 'Giơ cả hai tay về phía trước, ngang vai, rồi giữ.',
    speechPrompt: 'Nói to câu: Hôm nay trời đẹp.',
    phrase: 'Hôm nay trời đẹp',
    remain: (seconds: number) => `Còn ${seconds} giây`,
    denied: 'Chưa dùng được camera. Hãy cho phép quyền camera rồi thử lại.',
    modelError: 'Chưa tải được bộ nhận diện. Hãy kiểm tra mạng rồi thử lại.',
    genericError: 'Bài luyện bị dừng. Hãy thử lại. Nếu bạn đang có triệu chứng thật, hãy gọi 115.',
    summaries: {
      attention: 'Có dấu hiệu cần chú ý trong bài luyện. Nếu đây là triệu chứng thật, hãy gọi 115.',
      'no-clear-difference': 'Bài luyện không thấy lệch rõ. Bài này không loại trừ đột quỵ.',
      incomplete: 'Chưa nhận được đủ thao tác mặt hoặc tay. Hãy làm lại ở nơi đủ sáng, nhìn thẳng vào camera.'
    },
    steps: { face: 'Mặt', arms: 'Tay', speech: 'Lời nói' },
    verdicts: {
      even: 'Không thấy lệch rõ',
      uneven: 'Có lệch cần chú ý',
      missing: 'Chưa nhận được thao tác'
    },
    speech: {
      heard: 'Đã nghe câu nói',
      unclear: 'Chưa nghe rõ. Điều này không được tính là nói khó.',
      skipped: 'Trình duyệt không hỗ trợ nhận giọng nói, bước nói được bỏ qua và không tính là nói khó.'
    }
  },
  quiz: {
    label: 'Kiểm tra',
    title: 'Quiz nhanh',
    intro: 'Năm câu về FAST và việc không được làm. Điểm lưu trên trình duyệt này.',
    previous: (score: number, total: number) => `Lần trước: ${score}/${total} câu đúng`,
    progress: (index: number, total: number) => `Câu ${index}/${total}`,
    next: 'Câu tiếp theo',
    finish: 'Xem kết quả',
    resultLabel: 'Kết quả bài kiểm tra',
    result: (score: number, total: number) => `${score}/${total} câu đúng`,
    good: 'Bạn nhớ các việc cần làm. Nếu đang có người có triệu chứng thật, hãy gọi 115.',
    review: 'Xem lại phần FAST phía trên, rồi làm lại.',
    retry: 'Làm lại',
    questions: [
      {
        question: 'Trong quy tắc FAST, chữ T nhắc bạn làm gì?',
        options: ['Ghi thời điểm triệu chứng và gọi 115', 'Đo thân nhiệt', 'Cho uống thuốc ngay'],
        answer: 0
      },
      {
        question: 'Thấy méo miệng và một tay yếu xuất hiện đột ngột, việc đúng là gì?',
        options: ['Gọi 115 ngay và ghi giờ bắt đầu', 'Cho uống nước đường rồi theo dõi', 'Đợi một giờ xem có tự khỏi'],
        answer: 0
      },
      {
        question: 'Khi nghi đột quỵ, có nên cho người đó ăn hoặc uống không?',
        options: ['Không cho ăn, uống hay tự dùng thuốc', 'Có, để đỡ hạ đường huyết', 'Chỉ uống một ngụm nước'],
        answer: 0
      },
      {
        question: 'Một tay rơi xuống khi giơ hai tay là dấu hiệu của bước nào?',
        options: ['Arms — Tay', 'Time — Thời gian', 'Chỉ là mệt, không cần để ý'],
        answer: 0
      },
      {
        question: 'Bài luyện trước camera dùng để làm gì?',
        options: ['Ôn thao tác và không thay thế việc gọi 115', 'Kết luận chắc chắn là không bị đột quỵ nếu thao tác đều', 'Chẩn đoán đột quỵ tại nhà'],
        answer: 0
      }
    ] satisfies QuizQuestion[]
  }
}

export const HABIT_STORAGE_KEY = 'sos-now-stroke-habits'
export const QUIZ_STORAGE_KEY = 'sos-now-stroke-quiz'
