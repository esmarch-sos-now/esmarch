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
    title: 'Nhận biết đột quỵ',
    description: 'Nhận dấu hiệu FAST trước camera và ghi năm động tác theo video. Bài luyện không chẩn đoán đột quỵ.'
  },
  {
    // Courses are open only to accounts registered as responders (see /app/san-sang-ho-tro)
    path: '/app/khoa-hoc',
    nav: 'Khóa học',
    title: 'Khóa học sơ cứu cho người hỗ trợ',
    description: 'Video sơ cứu ngắn và câu hỏi kiểm tra dành riêng cho người đã đăng ký hỗ trợ dự án.'
  },
  {
    // Tìm người hỗ trợ đã có (/app/nguoi-ho-tro); phần tìm AED làm sau
    path: '/app/nguoi-ho-tro',
    nav: 'Tìm kiếm AED và người hỗ trợ',
    title: 'Tìm người hỗ trợ gần bạn'
  },
  {
    path: '/app/san-sang-ho-tro',
    nav: 'Chế độ hỗ trợ',
    title: 'Sẵn sàng hỗ trợ'
  }
]

// Màn hình Nút SOS: nhấn nút mở màn Cơ sở y tế gần nhất kèm hộp xác nhận gọi 115
export const sosScreen = {
  question: 'Bạn đang gặp nguy hiểm?',
  hint: 'Nhấn nút bên dưới để gọi 115 và xem cơ sở y tế gần bạn nhất. Hãy bình tĩnh, trợ giúp sẽ sớm đến với bạn.',
  button: 'SOS',
  buttonLabel: 'Gọi 115 ngay',
  note: 'Cuộc gọi đến 115 hoàn toàn miễn phí.',
  findHelper: 'Tìm người biết sơ cứu gần bạn'
}

// "Tìm kiếm người hỗ trợ": người cần giúp (/app/nguoi-ho-tro) và người hỗ trợ (/app/san-sang-ho-tro)
export const supportCopy = {
  requester: {
    title: 'Tìm người hỗ trợ gần bạn',
    subtitle: 'Gửi tín hiệu tới những người hỗ trợ đã xác minh đang sẵn sàng. Họ thấy khu vực, mô tả, ảnh và video; vị trí chính xác và số điện thoại chỉ được chia sẻ với người nhận trợ giúp.',
    locating: 'Đang xác định vị trí của bạn…',
    located: 'Đã có vị trí của bạn.',
    locationDenied: 'Chưa được phép lấy vị trí. Hãy cho phép vị trí trong trình duyệt để gửi tín hiệu.',
    phone: 'Số điện thoại để người hỗ trợ gọi lại',
    phoneHint: 'Chỉ người nhận trợ giúp mới thấy số này.',
    accountPhoneHint: 'Số điện thoại đã đăng ký của tài khoản. Chỉ người nhận trợ giúp mới thấy số này.',
    situation: 'Tình huống',
    description: 'Mô tả ngắn (không bắt buộc)',
    descriptionPlaceholder: 'Ví dụ: người lớn tuổi ngã ở cổng chợ, còn thở nhưng không trả lời',
    photos: 'Ảnh hiện trường (không bắt buộc)',
    photo: 'Ảnh',
    addPhoto: 'Thêm ảnh',
    removePhoto: 'Xoá ảnh',
    consent: 'Tôi đồng ý chia sẻ vị trí và số điện thoại với người nhận trợ giúp, và ảnh, video với những người hỗ trợ được báo. Thông tin sẽ được xoá khi yêu cầu kết thúc.',
    demoStart: 'Bắt đầu demo SOS',
    demoDone: 'Kết thúc demo',
    needDescription: 'Hãy nhập mô tả tình huống (ghi âm sẽ tự điền vào ô mô tả).',
    mediaFailed: (n: number) => `Chưa gửi được ${n} tệp ảnh/video. Yêu cầu vẫn được gửi; hãy mô tả bằng chữ hoặc gọi 115 nếu khẩn cấp.`,
    send: 'Gửi tín hiệu tìm người hỗ trợ',
    needLocation: 'Chưa có vị trí của bạn. Hãy cho phép vị trí rồi thử lại.',
    badPhone: 'Số điện thoại chưa đúng.',
    needConsent: 'Hãy đồng ý chia sẻ thông tin để gửi tín hiệu.',
    badInput: 'Thông tin chưa hợp lệ, hãy kiểm tra lại.',
    network: 'Chưa gửi được tín hiệu. Hãy thử lại hoặc gọi 115.',
    sendingSignal: 'Đang gửi tín hiệu…',
    searching: 'Đang tìm người hỗ trợ…',
    invited: (count: number) => (count > 0 ? `Đã báo cho ${count} người hỗ trợ đang sẵn sàng` : 'Đang chờ người hỗ trợ'),
    live: 'Kết nối trực tiếp',
    connecting: 'Đang kết nối…',
    polling: 'Kết nối dự phòng (cập nhật mỗi 3 giây)',
    noOneYet: 'Chưa có ai nhận sau 2 phút. Hãy gọi 115 hoặc tới cơ sở y tế gần nhất, yêu cầu của bạn vẫn đang được giữ.',
    facilities: 'Cơ sở y tế gần nhất',
    cancel: 'Huỷ yêu cầu',
    accepted: 'Đã có người nhận trợ giúp',
    onTheWay: 'Đang trên đường tới chỗ bạn',
    distance: (d: string) => `Cách bạn ${d}`,
    callResponder: 'Gọi',
    responderPin: 'Người hỗ trợ',
    ended: {
      completed: 'Người hỗ trợ đã đánh dấu hoàn thành. Chúc bạn và người bị nạn bình an.',
      cancelled: 'Đã huỷ yêu cầu.',
      expired: 'Yêu cầu đã hết hạn.'
    },
    again: 'Gửi yêu cầu mới',
    none: 'Hiện chưa có người hỗ trợ nào đang sẵn sàng',
    noneHint: 'Hãy gọi 115 hoặc tới cơ sở y tế gần nhất. Bạn có thể thử gửi lại sau ít phút.',
    retry: 'Thử lại',
    helperPrompt: 'Bạn biết sơ cứu và muốn giúp người khác?',
    helperLink: 'Bật "Sẵn sàng hỗ trợ"'
  },
  responder: {
    title: 'Sẵn sàng hỗ trợ',
    signIn: 'Đăng nhập để đăng ký làm người hỗ trợ.',
    signInButton: 'Đăng nhập',
    enrollTitle: 'Đăng ký làm người hỗ trợ',
    enrollHint: 'Bản demo: bạn tự khai, chưa cần xác minh chứng chỉ sơ cứu.',
    enrollDisabled: 'Tài khoản của bạn chưa được xác minh là người hỗ trợ nên chưa dùng được chế độ này.',
    name: 'Tên hiển thị',
    phone: 'Số điện thoại (người cần giúp sẽ thấy sau khi bạn nhận)',
    badPhone: 'Số điện thoại chưa đúng.',
    enrollFailed: 'Chưa đăng ký được, hãy thử lại.',
    enroll: 'Đăng ký',
    on: 'Đang sẵn sàng hỗ trợ',
    turningOn: 'Đang bật…',
    off: 'Chưa sẵn sàng',
    turnOn: 'Bật sẵn sàng',
    turnOff: 'Tắt',
    courseLink: 'Học khóa sơ cứu',
    locating: 'Đang xác định vị trí của bạn…',
    locationDenied: 'Chưa được phép lấy vị trí. Hãy cho phép vị trí để chia sẻ trong phiên hỗ trợ.',
    locationPrivacy: 'Khi chờ yêu cầu, trang không lấy GPS. Vị trí chỉ được hỏi sau khi bạn nhận một yêu cầu và chỉ dùng trong phiên hỗ trợ.',
    connection: {
      open: 'Kết nối trực tiếp',
      connecting: 'Đang kết nối…',
      polling: 'Kết nối dự phòng (cập nhật mỗi 3 giây)',
      closed: 'Mất kết nối, hãy tải lại trang'
    },
    dismiss: 'Đóng',
    testSound: 'Thử âm thanh',
    incoming: 'Yêu cầu trợ giúp',
    waiting: 'Chưa có yêu cầu nào. Hãy để trang này mở.',
    offHint: 'Bật sẵn sàng để nhận yêu cầu.',
    alertTitle: 'Có người cần trợ giúp',
    someone: 'Người cần trợ giúp',
    away: (d: string) => `Cách bạn khoảng ${d}`,
    requestArea: (area: string) => `Khu vực: ${area}`,
    previewClosed: 'Bản xem trước: chưa nhận yêu cầu thật nào.',
    photoCount: (n: number) => `${n} ảnh`,
    accept: 'Nhận',
    decline: 'Bỏ qua',
    taken: 'Yêu cầu đã có người khác nhận.',
    cancelled: 'Người cần giúp đã huỷ yêu cầu.',
    expired: 'Yêu cầu đã hết hạn.',
    completed: 'Đã hoàn thành. Cảm ơn bạn!',
    helping: 'Bạn đang hỗ trợ',
    call: 'Gọi',
    complete: 'Đã đến / Hoàn thành',
    photo: 'Ảnh hiện trường',
    routesHint: 'bấm tuyến xám trên bản đồ để đổi tuyến',
    requesterPin: 'Người cần hỗ trợ'
  }
}

// First-aid courses: only accounts registered as responders can open the content
export const courseCopy = {
  eyebrow: 'Dành cho người hỗ trợ',
  title: 'Khóa học sơ cứu',
  subtitle:
    'Hai khóa ngắn từ video của bác sĩ Bệnh viện Hoàn Mỹ Đà Nẵng. Xem video từng bài rồi làm câu hỏi kiểm tra; khóa đã hoàn thành được ghi nhận lên hồ sơ của bạn.',
  signIn: 'Đăng nhập để học khóa sơ cứu dành cho người hỗ trợ.',
  signInButton: 'Đăng nhập',
  loading: 'Đang tải khóa học…',
  lockedTitle: 'Khóa học dành riêng cho người hỗ trợ',
  lockedBody:
    'Chỉ tài khoản đã đăng ký làm người hỗ trợ của dự án mới học được khóa này. Đăng ký (demo) mất chưa đến một phút, sau đó quay lại đây để mở khóa toàn bộ bài học.',
  lockedAction: 'Đăng ký làm người hỗ trợ',
  enrolledAs: (name: string) => `Bạn đang học với tư cách người hỗ trợ: ${name}`,
  progress: (done: number, total: number) => `${done}/${total} bài đã hoàn thành`,
  completed: 'Đã hoàn thành khóa học',
  next: 'Học bài tiếp theo',
  lesson: (index: number) => `Bài ${index}`,
  minutes: (minutes: number) => `${minutes} phút`,
  done: 'Đã học',
  quizTitle: 'Kiểm tra nhanh',
  quizHint: 'Câu hỏi được tạo ngẫu nhiên từ tài liệu sơ cứu, mỗi lần làm là một bộ khác. Trả lời đúng tất cả để hoàn thành bài học.',
  quizLoading: 'Đang tạo bộ câu hỏi…',
  quizLoadFailed: 'Chưa tải được bài kiểm tra. Hãy thử lại.',
  quizStale: 'Bộ câu hỏi vừa được cập nhật, đây là bộ câu hỏi mới.',
  submit: 'Nộp bài',
  submitting: 'Đang chấm…',
  retry: 'Làm bộ câu hỏi khác',
  passed: 'Chính xác! Bạn đã hoàn thành bài học này.',
  lessonDone: 'Đã hoàn thành bài học',
  failed: (correct: number, total: number) => `Đúng ${correct}/${total} câu. Xem giải thích rồi thử lại nhé.`,
  correctAnswer: 'Đáp án đúng',
  answerRequired: 'Hãy trả lời đủ các câu hỏi trước khi nộp.',
  loadFailed: 'Chưa tải được khóa học. Hãy thử lại.',
  lockedNotice: 'Tài khoản này chưa phải người hỗ trợ đã đăng ký nên nội dung khóa học được ẩn.',
  retryLoad: 'Thử lại',
  noCourses: 'Chưa có khóa học nào.',
  lessons:'Nội dung khóa học',
  // Course picker
  pickCourse: 'Chọn khóa học',
  lessonCount: (done: number, total: number) => `${done}/${total} bài`,
  courseDone: 'Đã hoàn thành',
  // Video and the notes under it
  videoCredit: (title: string, source: string) => `Video: ${title} — ${source}`,
  watchOnYouTube: 'Xem trên YouTube',
  playVideo: (title: string) => `Phát video: ${title}`,
  videoBlockedHint: 'Video không phát được trên trang (do trình duyệt hoặc tiện ích chặn quảng cáo)? Bấm "Xem trên YouTube".',
  newTab: '(mở thẻ mới)',
  keyPoints: 'Ghi nhớ',
  // Watch the video first, then take the quiz
  watchedButton: 'Tôi đã xem xong video — làm bài kiểm tra',
  quizLocked: 'Xem hết video ở trên, sau đó bấm nút để mở bài kiểm tra.',
  // Recorded on the profile when the course is finished
  recorded: (badge: string) => `Đã ghi nhận lên hồ sơ: ${badge}`,
  completedOn: (date: string) => `Hoàn thành ngày ${date}`,
  viewProfile: 'Xem hồ sơ',
  // Video source
  sourceTitle: 'Nguồn video',
  sourcePlaylist: 'Danh sách phát',
  // "Khóa học sơ cứu" card on the account page
  profile: {
    title: 'Khóa học sơ cứu',
    loading: 'Đang tải…',
    loadFailed: 'Chưa tải được thông tin khóa học.',
    none: 'Chưa hoàn thành khóa học nào.',
    start: 'Vào học',
    notEnrolled: 'Khóa học sơ cứu dành cho người hỗ trợ.',
    enroll: 'Đăng ký làm người hỗ trợ',
    completedOn: (date: string) => `Hoàn thành ${date}`,
  },
  // Chips on the responder / requester screens
  earned: 'Khóa đã hoàn thành',
  responderCompleted: 'Đã hoàn thành:',
}

/** Course completion date in Vietnamese format (dd/mm/yyyy); empty string when it cannot be parsed. */
export function formatCourseDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN')
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
  // Nút gọi cạnh mỗi số tổng đài của cơ sở y tế (mở trình gọi điện qua tel:)
  callNumber: 'Gọi',
  // Dẫn đường tới cơ sở (Mapbox Directions): chỉ xe máy và ô tô
  directions: {
    start: 'Dẫn đường',
    title: 'Chỉ đường tới',
    vehicle: 'Phương tiện',
    close: 'Đóng chỉ đường',
    loading: 'Đang tìm đường đi…',
    routes: 'Các tuyến đường',
    best: 'Đề xuất',
    alternative: 'Tuyến khác',
    steps: 'Xem từng bước',
    fromCenter: 'Chưa định vị được bạn: đang chỉ đường từ trung tâm TP.HCM.',
    motorbikeNote: 'Xe máy: tuyến tránh đường cao tốc, thời gian là ước tính.'
  },
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
