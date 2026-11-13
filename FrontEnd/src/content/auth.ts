// Nội dung các màn hình tài khoản: đăng nhập, đăng ký (OTP qua SMS), quên mật khẩu, tài khoản
export const authCopy = {
  emergency: 'Nút SOS và trợ lý sơ cứu vẫn dùng được khi chưa đăng nhập. Trong nguy hiểm tính mạng, hãy gọi ngay',
  fields: {
    name: 'Tên hiển thị (không bắt buộc)',
    phone: 'Số điện thoại',
    email: 'Email',
    password: 'Mật khẩu',
    newPassword: 'Mật khẩu mới',
    currentPassword: 'Mật khẩu hiện tại',
    confirmPassword: 'Nhập lại mật khẩu',
    code: 'Mã xác nhận 6 số'
  },
  hints: {
    password: 'Ít nhất 8 ký tự.',
    phone: 'Số di động Việt Nam, ví dụ 0912 345 678. Chúng tôi sẽ gửi mã xác nhận qua SMS.'
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
    submit: 'Gửi mã xác nhận',
    haveAccount: 'Đã có tài khoản?',
    toLogin: 'Đăng nhập'
  },
  sms: {
    title: 'Nhập mã xác nhận',
    lede: (phone: string) => `Chúng tôi đã gửi mã 6 số qua SMS tới ${phone}.`,
    submit: 'Xác nhận',
    resend: 'Gửi lại mã',
    resendIn: (seconds: number) => `Gửi lại mã sau ${seconds}s`,
    resent: 'Đã gửi mã mới.',
    back: 'Đổi số điện thoại'
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
    lede: 'Nhập số điện thoại của tài khoản, chúng tôi sẽ gửi mã qua SMS để đặt lại mật khẩu.',
    submit: 'Gửi mã',
    newPasswordTitle: 'Đặt mật khẩu mới',
    newPasswordLede: (phone: string) => `Đã xác nhận ${phone}. Hãy chọn mật khẩu mới.`,
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
    invalidLogin: 'Số điện thoại hoặc mật khẩu không đúng.',
    invalidCode: 'Mã không đúng hoặc đã hết hạn. Hãy kiểm tra lại hoặc gửi mã mới.',
    codeExpired: 'Mã đã hết hạn. Hãy bấm "Gửi lại mã".',
    invalidEmail: 'Email không hợp lệ.',
    emailRequired: 'Hãy nhập email.',
    invalidPhone: 'Số điện thoại không hợp lệ. Hãy nhập số di động Việt Nam, ví dụ 0912 345 678.',
    phoneRequired: 'Hãy nhập số điện thoại.',
    phoneTaken: 'Số điện thoại này đã có tài khoản. Hãy đăng nhập hoặc dùng "Quên mật khẩu".',
    phoneUnknown: 'Chưa có tài khoản nào với số điện thoại này.',
    phoneSessionExpired: 'Phiên xác nhận đã hết hạn. Hãy gửi lại mã.',
    smsNotConfigured: 'Chưa bật gửi mã SMS. Hãy liên hệ quản trị viên.',
    smsQuota: 'Hệ thống tạm thời không gửi được SMS. Hãy thử lại sau.',
    captchaFailed: 'Không xác minh được trình duyệt. Hãy tải lại trang và thử lại.',
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
