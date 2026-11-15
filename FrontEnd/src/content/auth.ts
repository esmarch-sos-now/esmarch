// Nội dung các màn hình tài khoản: đăng nhập và đăng ký bằng số điện thoại + mật khẩu, mã SMS để xác minh số,
// quên mật khẩu, tài khoản
export const authCopy = {
  emergency: 'Nút SOS và trợ lý sơ cứu vẫn dùng được khi chưa đăng nhập. Trong nguy hiểm tính mạng, hãy gọi ngay',
  fields: {
    name: 'Tên hiển thị (không bắt buộc)',
    phone: 'Số điện thoại',
    countryCode: 'Mã quốc gia',
    password: 'Mật khẩu',
    newPassword: 'Mật khẩu mới',
    currentPassword: 'Mật khẩu hiện tại',
    confirmPassword: 'Nhập lại mật khẩu',
    code: 'Mã xác nhận 6 số'
  },
  hints: {
    password: 'Ít nhất 8 ký tự.',
    phone: 'Hiện chỉ hỗ trợ số di động Việt Nam (+84). Chúng tôi sẽ gửi mã xác nhận qua SMS.'
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
  sms: {
    title: 'Xác minh số điện thoại',
    lede: (phone: string) => `Chúng tôi đã gửi mã 6 số qua SMS tới ${phone}.`,
    submit: 'Xác nhận',
    resend: 'Gửi lại mã',
    resendIn: (seconds: number) => `Gửi lại mã sau ${seconds}s`,
    resent: 'Đã gửi mã mới.',
    back: 'Đổi số điện thoại'
  },
  forgot: {
    title: 'Quên mật khẩu',
    lede: 'Nhập số điện thoại của tài khoản, chúng tôi sẽ gửi mã qua SMS để xác minh trước khi đặt lại mật khẩu.',
    submit: 'Gửi mã',
    newPasswordTitle: 'Đặt mật khẩu mới',
    newPasswordLede: (phone: string) => `Đã xác minh ${phone}. Hãy chọn mật khẩu mới. Mọi thiết bị sẽ bị đăng xuất.`,
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
    phoneRequired: 'Hãy nhập số điện thoại.',
    invalidPhone: 'Số điện thoại di động Việt Nam chưa hợp lệ.',
    phoneTaken: 'Số điện thoại này đã có tài khoản. Hãy đăng nhập, hoặc dùng “Quên mật khẩu”.',
    phoneUnknown: 'Chưa có tài khoản nào dùng số điện thoại này.',
    phoneNotConfirmed: 'Số điện thoại chưa được xác minh.',
    invalidCode: 'Mã không đúng hoặc đã hết hạn. Hãy kiểm tra lại hoặc gửi mã mới.',
    codeFormat: 'Mã gồm 6 chữ số.',
    smsFailed: 'Chưa gửi được SMS. Hãy kiểm tra số điện thoại hoặc thử lại sau.',
    smsDisabled: 'Đăng nhập bằng số điện thoại chưa được bật.',
    passwordRequired: 'Hãy nhập mật khẩu.',
    passwordShort: 'Mật khẩu cần ít nhất 8 ký tự.',
    passwordLong: 'Mật khẩu tối đa 72 ký tự.',
    nameLong: 'Tên tối đa 100 ký tự.',
    passwordMismatch: 'Hai mật khẩu chưa khớp.',
    wrongCurrent: 'Mật khẩu hiện tại không đúng.',
    samePassword: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
    weakPassword: 'Mật khẩu quá yếu. Hãy chọn mật khẩu khác.',
    signupDisabled: 'Hiện chưa mở đăng ký tài khoản mới.',
    disabled: 'Tài khoản đã bị khóa.',
    tooMany: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.',
    unavailable: 'Chưa kết nối được dịch vụ. Hãy thử lại sau.',
    generic: 'Có lỗi xảy ra. Hãy thử lại.'
  }
}
