// Nội dung các màn hình tài khoản: đăng nhập, đăng ký, xác nhận email, quên mật khẩu, tài khoản
export const authCopy = {
  emergency: 'Nút SOS và trợ lý sơ cứu vẫn dùng được khi chưa đăng nhập. Trong nguy hiểm tính mạng, hãy gọi ngay',
  fields: {
    name: 'Tên hiển thị (không bắt buộc)',
    email: 'Email',
    password: 'Mật khẩu',
    newPassword: 'Mật khẩu mới',
    currentPassword: 'Mật khẩu hiện tại',
    confirmPassword: 'Nhập lại mật khẩu',
    code: 'Mã xác nhận 6 số'
  },
  hints: {
    password: 'Ít nhất 8 ký tự.'
  },
  login: {
    title: 'Đăng nhập',
    lede: 'Đăng nhập để lưu tiến độ khóa học và quản lý gói sử dụng.',
    submit: 'Đăng nhập',
    forgot: 'Quên mật khẩu?',
    noAccount: 'Chưa có tài khoản?',
    toRegister: 'Đăng ký',
    resetDone: 'Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.'
  },
  register: {
    title: 'Đăng ký',
    lede: 'Tạo tài khoản SOS NOW để học sơ cứu và nâng cấp gói Pro, Ultra.',
    submit: 'Tạo tài khoản',
    haveAccount: 'Đã có tài khoản?',
    toLogin: 'Đăng nhập'
  },
  verify: {
    title: 'Xác nhận email',
    lede: (email: string) => `Chúng tôi đã gửi mã 6 số tới ${email}. Mã có hiệu lực trong 10 phút.`,
    submit: 'Xác nhận',
    resend: 'Gửi lại mã',
    resendIn: (seconds: number) => `Gửi lại mã sau ${seconds}s`,
    resent: 'Nếu email hợp lệ, mã mới đã được gửi.',
    back: 'Dùng email khác'
  },
  forgot: {
    title: 'Quên mật khẩu',
    lede: 'Nhập email tài khoản, chúng tôi sẽ gửi mã để đặt lại mật khẩu.',
    submit: 'Gửi mã',
    resetLede: (email: string) => `Nếu ${email} có tài khoản, mã 6 số đã được gửi tới email này.`,
    resetSubmit: 'Đặt lại mật khẩu',
    backToLogin: 'Quay lại đăng nhập'
  },
  account: {
    title: 'Tài khoản',
    signedInAs: 'Đăng nhập với',
    memberSince: 'Tham gia từ',
    profile: 'Thông tin cá nhân',
    save: 'Lưu',
    saved: 'Đã lưu.',
    password: 'Đổi mật khẩu',
    passwordSubmit: 'Đổi mật khẩu',
    passwordChanged: 'Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.',
    sessions: 'Phiên đăng nhập',
    logout: 'Đăng xuất',
    logoutAll: 'Đăng xuất mọi thiết bị'
  },
  nav: {
    account: 'Tài khoản'
  },
  errors: {
    invalidLogin: 'Email hoặc mật khẩu không đúng.',
    invalidCode: 'Mã không đúng hoặc đã hết hạn. Hãy kiểm tra lại hoặc gửi mã mới.',
    invalidEmail: 'Email không hợp lệ.',
    emailRequired: 'Hãy nhập email.',
    passwordRequired: 'Hãy nhập mật khẩu.',
    passwordShort: 'Mật khẩu cần ít nhất 8 ký tự.',
    passwordLong: 'Mật khẩu tối đa 128 ký tự.',
    nameLong: 'Tên tối đa 100 ký tự.',
    codeFormat: 'Mã gồm 6 chữ số.',
    passwordMismatch: 'Hai mật khẩu chưa khớp.',
    wrongCurrent: 'Mật khẩu hiện tại không đúng.',
    disabled: 'Tài khoản đã bị khóa.',
    tooMany: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.',
    unavailable: 'Chưa kết nối được dịch vụ. Hãy thử lại sau.',
    generic: 'Có lỗi xảy ra. Hãy thử lại.'
  }
}
