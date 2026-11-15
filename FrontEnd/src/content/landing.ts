// Nội dung landing page (mẫu nền tối: Hero ảnh bàn tay, Vấn đề, Quy trình, Tính năng, Chuyên gia, rồi các mục cũ).
export const navLinks = [
  { id: 'cach-hoat-dong', label: 'HDSD' },
  { id: 'tinh-nang', label: 'Tính năng' },
  { id: 'bang-gia', label: 'Bảng giá' },
  { id: 'doi-ngu', label: 'Về chúng tôi' }
]

export const hero = {
  eyebrow: 'Sơ cứu khẩn cấp với',
  title: 'SOS NOW',
  description: 'Giọng nói AI hướng dẫn bạn sơ cứu từng bước, đào tạo kỹ năng và kết nối nhanh với 115 cùng cơ sở y tế gần nhất.',
  prompt: 'Ấn để tìm hiểu thêm',
  cta: 'Bắt đầu ngay',
  imageAlt: 'Hai bàn tay nắm chặt lấy nhau',
  // Ảnh điện thoại màn SOS, dùng ở phần tải app cuối trang
  phoneAlt: 'Màn hình SOS của ứng dụng SOS NOW: nút SOS lớn và nút gọi 115'
}

// Vấn đề: chưa đưa số liệu, khi có nguồn tin cậy thì bổ sung vào từng thẻ
export const problem = {
  label: 'Vấn đề',
  title: 'Khi sự cố xảy ra, bạn sẽ làm gì?',
  items: [
    { icon: 'help', title: 'Lúng túng, hoảng loạn', text: 'Khi có người bất tỉnh, hóc dị vật hay đột quỵ, phần lớn người chứng kiến không biết nên bắt đầu từ đâu.' },
    { icon: 'timer', title: 'Bỏ lỡ thời gian vàng', text: 'Mỗi phút chậm trễ trước khi được sơ cứu đúng cách đều làm giảm cơ hội sống của nạn nhân.' },
    { icon: 'phone', title: 'Không biết gọi ai', text: 'Khi 115 bận hoặc không kết nối được, ít ai biết số của bệnh viện, cơ sở y tế gần mình nhất.' },
    { icon: 'book', title: 'Kiến thức dễ quên', text: 'Ít người được học sơ cứu bài bản, và những gì đã học rất dễ quên khi lâu không thực hành.' }
  ]
}

// Quy trình cơ bản: 3 ô chia bởi đường kẻ. Số cơ sở y tế theo dữ liệu đã xác minh (bệnh viện / trạm y tế)
export const howItWorks = {
  label: 'HDSD',
  title: 'Quy trình cơ bản',
  sos: {
    title: 'Ấn nút SOS',
    description: 'Chỉ một lần ấn nút SOS, ứng dụng lập tức định vị và tìm kiếm bệnh viện hoặc cơ sở y tế gần nhất.',
    chips: ['SOS', 'Gọi 115', 'Chia sẻ vị trí']
  },
  call: {
    title: 'Gọi hỗ trợ',
    description: 'Kết nối nhanh với 115 hoặc bệnh viện gần nhất. Trong khi AI tiếp tục hỗ trợ sơ cứu.',
    stats: [
      { label: 'Bệnh viện', value: 47 },
      { label: 'CSYT', value: 16 }
    ],
    verified: 'Đã được xác minh'
  },
  navigate: {
    title: 'Dẫn đường',
    description: 'Dẫn đường đến cơ sở y tế gần nhất giúp người trợ giúp tìm đến bạn nhanh hơn.',
    actions: ['Tìm đường', 'Dẫn đường']
  }
}

// Tính năng: SOS khẩn cấp ở trên (kèm 3 biểu tượng), 3 cột tính năng phía dưới
export const features = {
  label: 'Tính năng',
  sos: {
    title: 'SOS khẩn cấp',
    lines: ['Một lần chạm, tìm kiếm trợ giúp trong tình huống khẩn cấp', 'Phát tín hiệu SOS chỉ với một chạm'],
    icons: [
      { icon: 'siren', label: 'Phát tín hiệu SOS' },
      { icon: 'location', label: 'Định vị, chia sẻ vị trí' },
      { icon: 'hospital', label: 'Cơ sở y tế gần nhất' }
    ]
  },
  items: [
    {
      icon: 'voice',
      title: 'AI Voice',
      points: ['Rảnh tay sơ cứu, AI đọc từng bước cho bạn', 'Nhận diện tình huống qua giọng nói tiếng Việt', 'Hướng dẫn từng bước bằng giọng nói, video mô phỏng 3D']
    },
    {
      icon: 'search',
      title: 'Tìm người hỗ trợ',
      points: ['Tìm người sơ cứu đã được xác minh ở gần bạn', 'Gửi yêu cầu hỗ trợ kèm vị trí hiện tại', 'Người hỗ trợ nhận yêu cầu và tìm đến bạn', 'Theo dõi trạng thái yêu cầu theo thời gian thực']
    },
    {
      icon: 'practice',
      title: 'Luyện tập',
      points: [
        'Nhận biết dấu hiệu đột quỵ theo quy tắc FAST',
        'Luyện động tác trước camera, có nhận xét ngay',
        'Ghi năm động tác theo video hướng dẫn',
        'Theo dõi các ngày đã luyện tập trong tuần',
        'Bài luyện để tập, không dùng để chẩn đoán'
      ]
    }
  ]
}

// Chuyên gia: ảnh trong /public/site/expert
export const expert = {
  label: 'Chuyên gia',
  name: 'Thạc sĩ, Bác sĩ CKI - Võ Phương Quỳnh',
  role: 'Khoa Thần kinh, Đại học Y Dược TP.HCM',
  photo: '/site/expert/vo-phuong-quynh.webp',
  quote:
    'Người ta có một câu là "Time is brain" có nghĩa là thời gian chính là não. Bạn càng chậm trễ đưa bệnh nhân đến bệnh viện thì các tế bào não của bệnh nhân sẽ ngày càng thiếu máu nuôi và sẽ chết nhanh nhất. Nên là mình sẽ ưu tiên những nơi nào gần nhất có thể.',
  note: '*Chuyên gia tư vấn, đóng góp ý kiến - Không có vai trò và trách nhiệm với dự án.'
}

// Pricing: B2C Premium contracts (30 / 120 / 365 days) and a free B2B plan for organizations.
// The Premium plans share one feature list and differ only in duration and contract price. The "/tháng" figure in a
// note is the contract price divided by the number of months (120 days = 4 months, 365 days = 12 months).
const premiumFeatures = [
  'Hướng dẫn sơ cứu bằng giọng nói AI',
  'Nút SOS và gọi nhanh 115',
  'Toàn bộ khóa học online và quiz',
  'Định vị, chia sẻ vị trí và chỉ đường đến cơ sở y tế',
  'Ưu tiên kết nối người hỗ trợ ở gần',
  'Ưu đãi đăng ký lớp sơ cứu trực tiếp'
]

export const pricing = {
  title: 'Bảng giá',
  cta: 'Bắt đầu ngay',
  plans: [
    {
      id: 'b2c-30',
      name: 'B2C Premium · 30 ngày',
      price: '39.000đ',
      period: '',
      note: 'Thanh toán một lần',
      features: premiumFeatures
    },
    {
      id: 'b2c-120',
      name: 'B2C Premium · 120 ngày',
      price: '99.000đ',
      period: '',
      note: 'Tương đương 24.750đ/tháng',
      featured: true,
      ribbon: 'Đề xuất cho bạn',
      features: premiumFeatures
    },
    {
      id: 'b2c-365',
      name: 'B2C Premium · 365 ngày',
      price: '349.000đ',
      period: '',
      note: 'Tương đương 29.083đ/tháng',
      features: premiumFeatures
    },
    {
      id: 'b2b',
      name: 'B2B',
      price: '0đ',
      period: '',
      note: 'Miễn phí cho tổ chức',
      features: [
        'Dành cho trường học, doanh nghiệp và đơn vị',
        'Thành viên dùng nút SOS và gọi nhanh 115',
        'Hướng dẫn sơ cứu bằng giọng nói AI',
        'Triển khai không mất phí'
      ]
    }
  ]
}

// Về chúng tôi: thứ tự trong mảng là thứ tự trên băng chuyền, phần tử đầu nằm giữa khi tải trang
export const team = {
  label: 'Về chúng tôi',
  title: ['Gặp gỡ', 'đội ngũ sáng lập'],
  subtitle: 'Thành viên ESMARCH cùng xây dựng SOS NOW',
  members: [
    { id: 'my-dung', name: 'Mỹ Dung', role: 'Co-Founder & CEO', area: 'Điều hành chung' },
    { id: 'ngoc-huu', name: 'Ngọc Hữu', role: 'Chief Operating Officer', area: 'Vận hành' },
    { id: 'quynh-giao', name: 'Quỳnh Giao', role: 'Chief Financial Officer', area: 'Tài chính' },
    { id: 'yen-nhi', name: 'Yến Nhi', role: 'Chief Marketing Officer', area: 'Marketing' },
    { id: 'thu-huyen', name: 'Thu Huyền', role: 'Chief Technology Officer', area: 'Công nghệ' },
    { id: 'hoang-nam', name: 'Hoàng Nam', role: 'Chief AI Officer', area: 'Trí tuệ nhân tạo' }
  ]
}

// Câu hỏi thường gặp: câu trả lời bám theo phạm vi đã chốt (không cần đăng nhập, chỉ TP.HCM, vị trí không lưu lại)
export const faq = {
  label: 'FAQ',
  title: ['Câu hỏi', 'thường gặp'],
  subtitle: 'Những điều bạn nên biết trước khi dùng SOS NOW.',
  items: [
    { q: 'SOS NOW có thay thế việc gọi 115 không?', a: 'Không. SOS NOW giúp bạn gọi 115 nhanh hơn và hướng dẫn sơ cứu trong lúc chờ xe cấp cứu. Khi có nguy hiểm tính mạng, hãy luôn gọi 115 trước.' },
    { q: 'Nếu không gọi được 115 thì sao?', a: 'Ứng dụng hiển thị sẵn số điện thoại cấp cứu của bệnh viện, cơ sở y tế gần bạn nhất để bạn gọi trực tiếp.' },
    { q: 'SOS NOW dùng vị trí của tôi để làm gì?', a: 'Vị trí chỉ dùng để tìm bệnh viện, cơ sở y tế gần nhất và chỉ đường cho bạn. Vị trí không được chia sẻ cho ai và không được lưu lại.' }
  ]
}

export const sections = [
  { id: 'van-de', title: 'Vấn đề' },
  { id: 'cach-hoat-dong', title: 'Hướng dẫn sử dụng' },
  { id: 'tinh-nang', title: 'Tính năng' },
  { id: 'chuyen-gia', title: 'Chuyên gia' },
  { id: 'bang-gia', title: 'Bảng giá' },
  { id: 'doi-ngu', title: 'Về chúng tôi' },
  { id: 'faq', title: 'Câu hỏi thường gặp' },
  { id: 'cta', title: 'Kêu gọi hành động' }
]

export const callToAction = {
  //   giữ "SOS NOW" luôn trên cùng một dòng
  title: 'Sẵn sàng sơ cứu khẩn cấp với SOS NOW',
  stores: [
    { id: 'google-play', label: 'Tải SOS NOW trên Google Play' },
    { id: 'app-store', label: 'Tải SOS NOW trên App Store' }
  ]
}

// Link footer trỏ tới mục tương ứng trên landing hoặc trang app; mục chưa có trang riêng tạm về trang Nút SOS
export const footer = {
  developer: 'ESMARCH',
  contactLabel: 'Liên hệ:',
  contact: 'Đang cập nhật',
  columns: [
    { title: 'Company', links: [{ label: 'About Us', to: '/#doi-ngu' }, { label: 'Services', to: '/#tinh-nang' }, { label: 'Community', to: '/app/sos' }] },
    { title: 'Links', links: [{ label: 'Courses', to: '/#tinh-nang' }, { label: 'Become Teacher', to: '/app/sos' }, { label: 'Service', to: '/#bang-gia' }, { label: 'All in One', to: '/app/sos' }] },
    { title: 'Support', links: [{ label: 'Help Center', to: '/#faq' }] }
  ]
}
