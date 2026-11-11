// Các trang của ứng dụng: hiện chỉ có tiêu đề và mô tả chức năng, sẽ được làm dần
// Nút "Bắt đầu ngay" trên landing mở thẳng trang Nút SOS
export const appStart = '/app/sos'

export type AppPageDef = {
  path: string
  nav?: string
  title: string
  description?: string
  comingSoon?: boolean
}

export const appPages: AppPageDef[] = [
  {
    path: '/app/sos',
    nav: 'SOS',
    title: 'Nút SOS',
    description: 'Một chạm để gọi 115, đồng thời định vị vị trí hiện tại rồi chuyển sang danh sách cơ sở y tế gần nhất.'
  },
  {
    path: '/app/co-so-y-te',
    title: 'Cơ sở y tế gần nhất',
    description: 'Danh sách bệnh viện, cơ sở y tế gần vị trí hiện tại kèm số điện thoại để gọi khi không liên lạc được 115, cùng nút chỉ đường.'
  },
  {
    path: '/app/tro-ly',
    nav: 'Trợ lý sơ cứu',
    title: 'Trợ lý sơ cứu bằng giọng nói',
    description: 'Nói chuyện với trợ lý để được hướng dẫn sơ cứu từng bước bằng giọng nói và hình 3D.'
  },
  {
    path: '/app/luyen-tap',
    nav: 'Luyện tập',
    title: 'Luyện tập tránh đột quỵ',
    description: 'Ôn thói quen phòng ngừa, nhận dấu hiệu FAST, luyện thao tác trước camera và làm quiz. Bài luyện không chẩn đoán đột quỵ.'
  },
  // Hai tính năng dưới đây chưa làm, trang chỉ hiện dòng Coming Soon
  {
    path: '/app/tre-em',
    nav: 'Tính năng cho trẻ em',
    title: 'Tính năng cho trẻ em',
    comingSoon: true
  },
  {
    path: '/app/aed',
    nav: 'Tìm kiếm AED và người hỗ trợ',
    title: 'Tìm kiếm AED và người hỗ trợ',
    comingSoon: true
  }
]

// Màn hình Nút SOS: nhấn nút mở màn Cơ sở y tế gần nhất kèm hộp xác nhận gọi 115
export const sosScreen = {
  question: 'Bạn đang gặp nguy hiểm?',
  hint: 'Nhấn nút bên dưới để gọi 115 và xem cơ sở y tế gần bạn nhất. Hãy bình tĩnh, trợ giúp sẽ sớm đến với bạn.',
  button: 'SOS',
  buttonLabel: 'Gọi 115 ngay',
  note: 'Cuộc gọi đến 115 hoàn toàn miễn phí.'
}

// Menu trên các trang app; trang Cơ sở y tế được mở từ luồng SOS nên không nằm trong menu
export const appNav = appPages.filter((page) => page.nav).map((page) => ({ path: page.path, label: page.nav as string }))


// Màn hình Cơ sở y tế gần nhất: nhấn SOS sẽ mở màn này kèm hộp Gọi 115 / Hủy.
// Bản demo không gọi thật: nút Gọi chỉ hiện trạng thái đang gọi
// Màn hình Trợ lý sơ cứu bằng giọng nói
export const assistantScreen = {
  title: 'Trợ lý sơ cứu',
  lede: 'Bấm gọi và kể chuyện gì đang xảy ra. Trợ lý sẽ tự mở hướng dẫn phù hợp và đọc từng bước cho bạn.',
  start: 'Đồng ý và gọi trợ lý',
  again: 'Gọi lại',
  ended: 'Cuộc gọi đã kết thúc. Nếu vẫn nguy hiểm, hãy gọi 115.',
  reconnecting: 'Đang kết nối lại…',
  timeLimit: 'Cuộc gọi đã đạt thời gian tối đa. Bạn có thể gọi lại; nếu khẩn cấp, hãy gọi 115 ngay.',
  endingSoon: 'Cuộc gọi sắp đạt thời gian tối đa. Nếu vẫn cần giúp, bạn có thể gọi lại sau đó hoặc gọi 115.',
  problem: 'Trợ lý gặp sự cố và cuộc gọi đã dừng. Nếu khẩn cấp, hãy gọi 115 ngay.',
  connectionLost: 'Mất kết nối âm thanh với trợ lý. Nếu khẩn cấp, hãy gọi 115 ngay.',
  micLost: 'Micro đã bị ngắt hoặc mất quyền truy cập, cuộc gọi đã dừng. Nếu khẩn cấp, hãy gọi 115 ngay.',
  talkModeLabel: 'Cách nói',
  talkFree: 'Nói tự do',
  talkHold: 'Giữ để nói',
  holdIdle: 'Giữ nút để nói',
  holdActive: 'Đang nghe bạn…',
  holdLabel: 'Giữ để nói với trợ lý',
  noisyHint: 'Xung quanh đang ồn. Bật “Giữ để nói” để trợ lý chỉ nghe bạn.',
  noisyEnable: 'Bật',
  noisyDismiss: 'Bỏ qua gợi ý',
  consent:
    'Khi gọi, trình duyệt sẽ xin quyền micro. Âm thanh được gửi tới dịch vụ AI (OpenAI, qua Vercel AI Gateway) để trợ lý nghe và trả lời; trang này không lưu âm thanh. Trợ lý không thay thế cấp cứu: trong nguy hiểm tính mạng hãy gọi 115.'
}

export const facilityScreen = {
  title: 'Cơ sở y tế gần bạn',
  locating: 'Đang xác định vị trí của bạn…',
  located: 'Đã xác định vị trí. Đây là các cơ sở y tế gần bạn nhất.',
  failed: 'Không lấy được vị trí, đang hiển thị các cơ sở gần trung tâm TP.HCM.',
  retry: 'Thử định vị lại',
  call115: 'Gọi 115',
  showOnMap: 'Xem trên bản đồ',
  emergency: 'Có cấp cứu',
  hours24: 'Trực 24/24',
  distanceNote: 'đường chim bay',
  distanceRoad: 'theo đường đi',
  source: 'Số điện thoại theo danh sách bệnh viện của Tổng lãnh sự quán Singapore tại TP.HCM (cập nhật 06/11/2025); vị trí theo OpenStreetMap. Khoảng cách theo đường đi (hoặc đường chim bay khi ngoài vùng bản đồ đường).',
  dialog: {
    title: 'Gọi cấp cứu 115?',
    text: 'Bạn sắp gọi đến tổng đài cấp cứu 115. Danh sách cơ sở y tế gần bạn vẫn hiện ở phía sau.',
    call: 'Gọi',
    cancel: 'Hủy',
    calling: 'Đang gọi 115…',
    demo: 'Bản demo: không thực hiện cuộc gọi thật.',
    end: 'Kết thúc'
  }
}
