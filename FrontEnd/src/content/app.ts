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
    subtitle: 'Gửi tín hiệu tới những người hỗ trợ đã xác minh đang sẵn sàng. Họ thấy tình huống, mô tả, ảnh và video; vị trí chính xác và số điện thoại chỉ được chia sẻ với người nhận trợ giúp.',
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
    loading: 'Đang tải…',
    loadFailed: 'Chưa tải được thông tin người hỗ trợ.',
    retry: 'Thử lại',
    on: 'Đang sẵn sàng hỗ trợ',
    turningOn: 'Đang bật…',
    off: 'Chưa sẵn sàng',
    turnOn: 'Bật sẵn sàng',
    turnOff: 'Tắt',
    courseLink: 'Xem lại khóa học',
    welcomeTitle: 'Đăng ký thành công!',
    welcomeBody: 'Quản trị viên đã duyệt, bạn đã là người hỗ trợ của SOS NOW. Bấm "Bật sẵn sàng" khi bạn có thể nhận yêu cầu từ người cần giúp ở gần.',
    locating: 'Đang xác định vị trí của bạn…',
    locationDenied: 'Chưa được phép lấy vị trí. Hãy cho phép vị trí để chia sẻ trong phiên hỗ trợ.',
    locationPrivacy: 'Khi bật sẵn sàng, trang dùng vị trí của bạn để báo cho bạn những người cần giúp ở gần trước và cho bạn biết khoảng cách. Vị trí chỉ được lưu khi bạn đang sẵn sàng hoặc đang hỗ trợ, và bị xoá khi bạn tắt.',
    locationDeniedWaiting: 'Chưa lấy được vị trí của bạn: bạn chỉ được báo khi không có người hỗ trợ nào ở gần, và sẽ không thấy khoảng cách. Hãy cho phép vị trí trong trình duyệt.',
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
    // Before accepting, supporters share no GPS, so there is no distance to show (only radius requests have one)
    placeAfterAccepting: 'Vị trí chính xác và đường đi hiện sau khi bạn nhận',
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

// Becoming a supporter (/app/san-sang-ho-tro before verification): courses -> application -> admin verification
export const onboardingCopy = {
  title: 'Đăng ký làm người hỗ trợ',
  intro:
    'Người hỗ trợ nhận yêu cầu từ người cần giúp ở gần và đến tận nơi sơ cứu trong lúc chờ xe cấp cứu. Để bảo đảm an toàn cho người được giúp, chúng tôi chỉ nhận người đã học xong khóa sơ cứu của SOS NOW và được quản trị viên xác minh.',
  conditionsTitle: 'Điều kiện đăng ký',
  conditions: [
    'Có tài khoản SOS NOW đã xác minh số điện thoại (số người cần giúp sẽ gọi lại).',
    'Hoàn thành tất cả khóa sơ cứu của SOS NOW: xem video từng bài và trả lời đúng hết câu hỏi kiểm tra.',
    'Cam kết chỉ nhận yêu cầu khi thực sự có thể đến giúp và giữ kín thông tin của người cần giúp.',
    'Được quản trị viên xác minh. Kết quả được gửi qua email bạn cung cấp khi đăng ký.',
  ],
  begin: 'Bắt đầu đăng ký',
  signInToBegin: 'Đăng nhập để bắt đầu',
  signInHint: 'Chưa có tài khoản? Bạn có thể tạo tài khoản bằng số điện thoại ở trang đăng nhập.',
  steps: {
    courses: 'Hoàn thành khóa sơ cứu',
    apply: 'Gửi đăng ký',
    verify: 'Chờ xác minh',
  },
  stepState: { done: 'Xong', current: 'Đang ở bước này', next: 'Tiếp theo' },
  lessons: (done: number, total: number) => `${done}/${total} bài`,
  courseDone: 'Đã hoàn thành',
  start: 'Bắt đầu học',
  continue: 'Học tiếp',
  coursesHint: 'Mỗi bài có video và bài kiểm tra 5 câu; trả lời đúng hết để hoàn thành bài.',
  coursesTitle: 'Khóa học sơ cứu',
  hideCourses: 'Thu gọn',
  readyTitle: 'Bạn đã hoàn thành khóa học. Gửi đăng ký để được xác minh.',
  name: 'Tên hiển thị (người cần giúp sẽ thấy)',
  email: 'Email nhận kết quả xét duyệt',
  emailHint: 'Chỉ dùng để báo kết quả đăng ký người hỗ trợ.',
  badEmail: 'Email chưa đúng.',
  phone: 'Số điện thoại để người cần giúp gọi lại',
  phoneHint: 'Số đã xác minh của tài khoản. Người cần giúp chỉ thấy số này sau khi bạn nhận yêu cầu.',
  noPhone: 'Tài khoản chưa có số điện thoại đã xác minh. Hãy cập nhật số điện thoại ở trang tài khoản rồi quay lại.',
  commitment:
    'Tôi cam kết chỉ nhận yêu cầu khi thực sự có thể đến giúp, giữ kín thông tin của người cần giúp, và luôn khuyên gọi 115 khi có nguy hiểm tính mạng.',
  needCommitment: 'Hãy đánh dấu ô cam kết trước khi gửi.',
  submit: 'Gửi đăng ký',
  submitting: 'Đang gửi…',
  failed: 'Chưa gửi được đăng ký, hãy thử lại.',
  pendingTitle: 'Đăng ký đã được gửi',
  pendingBody: (date: string, email: string) =>
    `Bạn gửi đăng ký ngày ${date}. Quản trị viên đang xem lại hồ sơ và khóa học của bạn; kết quả sẽ được gửi tới ${email}. Khi được duyệt, quay lại trang này để bật chế độ sẵn sàng hỗ trợ.`,
  suspendedTitle: 'Tài khoản người hỗ trợ đang tạm khóa',
  suspendedBody: 'Bạn chưa thể nhận yêu cầu lúc này. Nếu cần, hãy liên hệ quản trị viên của SOS NOW.',
  reviewCourses: 'Xem lại khóa học',
}

// First-aid courses: open to every signed-in account; finishing them is the first step to becoming a supporter
export const courseCopy = {
  eyebrow: 'Khóa học cho người hỗ trợ',
  title: 'Khóa học sơ cứu',
  subtitle:
    'Hai khóa ngắn từ video của bác sĩ Bệnh viện Hoàn Mỹ Đà Nẵng. Xem video từng bài rồi làm câu hỏi kiểm tra; khóa đã hoàn thành được ghi nhận lên hồ sơ của bạn.',
  signIn: 'Đăng nhập để học khóa sơ cứu dành cho người hỗ trợ.',
  signInButton: 'Đăng nhập',
  loading: 'Đang tải khóa học…',
  enrolledAs: (name: string) => `Bạn đang học với tư cách người hỗ trợ: ${name}`,
  progress: (done: number, total: number) => `${done}/${total} bài đã hoàn thành`,
  completed: 'Đã hoàn thành khóa học',
  next: 'Học bài tiếp theo',
  lesson: (index: number) => `Bài ${index}`,
  minutes: (minutes: number) => `${minutes} phút`,
  done: 'Đã học',
  quizTitle: 'Kiểm tra nhanh',
  quizHint:
    'Câu hỏi được tạo ngẫu nhiên từ tài liệu sơ cứu, mỗi lần làm là một bộ khác. Trả lời đúng tất cả để hoàn thành bài học; đáp án và giải thích hiện khi bạn làm đúng hết.',
  quizNeedsVideo: 'Hãy xem hết video của bài học trước khi làm bài kiểm tra.',
  quizLoading: 'Đang tạo bộ câu hỏi…',
  quizLoadFailed: 'Chưa tải được bài kiểm tra. Hãy thử lại.',
  quizStale: 'Bộ câu hỏi vừa được cập nhật, đây là bộ câu hỏi mới.',
  submit: 'Nộp bài',
  submitting: 'Đang chấm…',
  retry: 'Làm bộ câu hỏi khác',
  passed: 'Chính xác! Bạn đã hoàn thành bài học này.',
  lessonDone: 'Đã hoàn thành bài học',
  failed: (correct: number, total: number) => `Đúng ${correct}/${total} câu. Xem lại các câu sai rồi thử bộ câu hỏi khác nhé.`,
  attemptsLeft: (left: number) => `Còn ${left} lần làm sai nữa trước khi phải xem lại video.`,
  mustRewatch: 'Bạn đã làm sai 2 lần liên tiếp. Hãy xem lại video, bài kiểm tra sẽ mở lại khi bạn xem xong.',
  rewatch: 'Xem lại video',
  wrongHint: 'Chưa đúng. Hãy nhớ lại nội dung video ở phần này.',
  correctAnswer: 'Đáp án đúng',
  wrongAnswer: 'Câu trả lời sai',
  answerRequired: 'Hãy trả lời đủ các câu hỏi trước khi nộp.',
  loadFailed: 'Chưa tải được khóa học. Hãy thử lại.',
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
  videoBlockedHint:
    'Cần xem video ngay trên trang này để mở bài kiểm tra. Video không phát được? Hãy tắt tiện ích chặn quảng cáo cho trang rồi tải lại.',
  playerBlocked: 'Không tải được trình phát video. Hãy tắt tiện ích chặn quảng cáo cho trang này rồi tải lại trang.',
  watchProgress: (watched: string, total: string) => `Đã xem ${watched} / ${total}`,
  watchNeed: (required: string) => `Xem đến ${required} để mở bài kiểm tra`,
  seekBlocked: 'Bạn chỉ tua lại được, không tua qua phần chưa xem.',
  watchDone: 'Đã xem xong video. Bài kiểm tra đã mở bên dưới.',
  newTab: '(mở thẻ mới)',
  keyPoints: 'Ghi nhớ',
  // Watch the video first, then take the quiz
  quizLocked: 'Xem ít nhất 90% video ở trên (không tua nhanh được) để mở bài kiểm tra và phần ghi nhớ.',
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
    supporter: 'Hoàn thành các khóa học để đăng ký làm người hỗ trợ.',
    becomeSupporter: 'Trở thành người hỗ trợ',
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
