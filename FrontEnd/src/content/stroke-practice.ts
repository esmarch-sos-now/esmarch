// Nội dung bài luyện tránh đột quỵ. Chỉ là ôn tập, không phải chẩn đoán.

export const strokePractice = {
  title: 'Nhận biết đột quỵ',
  lede: 'Cười, giơ hai tay và nói một câu trước camera, rồi ghi năm động tác mỗi ngày.',
  fast: {
    label: 'Nhận biết',
    title: 'FAST — làm ngay',
    intro: 'Mặt xệ, tay yếu hoặc nói khó: ghi giờ và gọi 115.',
    steps: [
      { letter: 'F', title: 'Mặt', text: 'Nhờ cười. Một bên có xệ không?' },
      { letter: 'A', title: 'Tay', text: 'Nhờ giơ hai tay. Một tay có rơi không?' },
      { letter: 'S', title: 'Lời nói', text: 'Nhờ nói một câu. Có nói khó không?' },
      { letter: 'T', title: 'Thời gian', text: 'Ghi giờ bắt đầu và gọi 115. Đừng tự lái xe.' }
    ],
    avoid: 'Không ăn, uống hay tự uống thuốc.',
    sos: 'Mở nút SOS',
    call: 'Gọi 115'
  },
  camera: {
    label: 'Trước camera',
    title: 'Căn theo nét mẫu',
    intro: 'Bấm nút tròn và căn người theo nét trắng.',
    follow: 'Căn theo nét trắng',
    frames: [
      { id: 'face' as const, title: 'Cười', text: 'Nhìn thẳng camera và cười.' },
      { id: 'arms' as const, title: 'Giơ hai tay', text: 'Giơ cả hai tay ngang vai và giữ.' },
      { id: 'speech' as const, title: 'Nói một câu', text: 'Nói to: Hôm nay trời đẹp.' }
    ],
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
      attention: 'Có lệch cần chú ý trong bài luyện. Nếu đây là triệu chứng thật, hãy gọi 115.',
      'no-clear-difference': 'Bài luyện không thấy lệch rõ. Bài này không loại trừ đột quỵ.',
      incomplete: (part: string) => `Chưa nhận được thao tác ${part}. Hãy làm lại ở nơi đủ sáng, nhìn thẳng vào camera.`
    },
    note: 'Không dùng để chẩn đoán.',
    steps: { face: 'Mặt', arms: 'Tay', speech: 'Lời nói' },
    verdicts: {
      even: 'Đã nhận',
      uneven: 'Cần chú ý',
      missing: 'Chưa thấy'
    },
    details: {
      face: {
        even: 'Khóe miệng đều.',
        uneven: 'Một bên miệng thấp hơn.',
        missing: 'Chưa thấy mặt. Nhìn thẳng và cười.'
      },
      arms: {
        even: 'Hai tay giơ đều.',
        uneven: 'Một tay thấp hơn.',
        missing: 'Chưa thấy hai tay. Giơ ngang vai và giữ.'
      }
    },
    speech: {
      heard: 'Đã nghe',
      unclear: 'Chưa rõ',
      skipped: 'Bỏ qua'
    },
    speechDetail: {
      heard: 'Nghe đúng câu mẫu.',
      unclear: 'Chưa nghe rõ câu mẫu.',
      skipped: 'Trình duyệt không nhận giọng nói.'
    }
  },
  daily: {
    label: 'Mỗi ngày',
    title: 'Năm động tác trong video',
    intro: 'Đánh dấu động tác đã làm hôm nay.',
    caution: 'Đừng nín thở. Chóng mặt, đau ngực hoặc khó thở thì dừng.',
    moves: [
      { id: 'fists', title: 'Nắm tay', text: 'Hít vào nắm chặt, thở ra thả lỏng. 100–200 lần.' },
      { id: 'shoulders', title: 'Mở vai', text: 'Đưa khuỷu ra sau, mở ngực, rồi thả. 4–8 phút.' },
      { id: 'neck', title: 'Cổ', text: 'Cúi đầu chậm theo hơi thở. Đừng ngửa quá.' },
      { id: 'side', title: 'Nghiêng người', text: 'Tay qua đầu, nghiêng sang bên kia, rồi đổi bên.' },
      { id: 'fengchi', title: 'Huyệt Phong trì', text: 'Day nhẹ hốc sau gáy, khoảng 3 phút.' }
    ],
    progress: (done: number, total: number) => `${done}/${total} động tác hôm nay`,
    streak: (days: number) => days > 0 ? `${days} ngày liên tiếp` : 'Chưa có chuỗi ngày',
    week: '7 ngày gần đây',
    empty: 'Chưa có buổi nào. Đánh dấu động tác hoặc làm bài camera để bắt đầu.',
    first: 'Đây là buổi đầu tiên được lưu.',
    movesCompare: (today: number, before: number) => `Hôm nay ${today}/5 động tác. Buổi trước ${before}/5.`,
    signs: {
      face: { even: 'mặt đều', uneven: 'mặt lệch', missing: 'chưa đủ mẫu mặt' },
      arms: { even: 'hai tay đều', uneven: 'tay lệch', missing: 'chưa đủ mẫu tay' },
      speech: { heard: 'nghe rõ câu mẫu', unclear: 'chưa nghe rõ câu mẫu', skipped: 'không kiểm tra giọng nói' }
    },
    recognize: (text: string) => `Nhận biết hôm nay: ${text}.`,
    recognizeCompare: (today: string, before: string) => `Nhận biết hôm nay: ${today}. Buổi trước: ${before}.`,
    attentionNote: 'Nếu lệch này là triệu chứng thật, hãy gọi 115.',
    note: 'Nhật ký chỉ lưu trên trình duyệt này.'
  }
}

export const DAY_STORAGE_KEY = 'sos-now-stroke-days'

