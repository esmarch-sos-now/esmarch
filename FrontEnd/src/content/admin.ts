// Nội dung khu quản trị (/admin): chỉ dành cho tài khoản Quản trị viên, chỉ để quản lý
export const adminCopy = {
  brand: 'Quản trị',
  nav: {
    group: 'Quản lý',
    users: 'Người dùng',
    responders: 'Người hỗ trợ',
    courses: 'Khóa học',
    account: 'Tài khoản của tôi',
    logout: 'Đăng xuất'
  },
  crumb: 'Quản trị',
  forbidden: {
    title: 'Không có quyền truy cập',
    lede: 'Khu này chỉ dành cho quản trị viên. Nếu bạn vừa bị đổi vai trò, hãy đăng xuất rồi đăng nhập lại.',
    logout: 'Đăng xuất',
    home: 'Về trang chủ'
  },
  roles: {
    USER: 'Người dùng',
    ADMIN: 'Quản trị viên'
  },
  users: {
    views: {
      all: 'Tất cả',
      admin: 'Quản trị viên',
      user: 'Người dùng',
      locked: 'Đã khóa'
    },
    search: 'Tìm tên, số điện thoại, email',
    columns: {
      name: (n: number) => `Tài khoản (${n})`,
      contact: 'Số điện thoại / Email',
      role: 'Vai trò',
      status: 'Trạng thái',
      joined: 'Tham gia',
      tags: 'Nhãn'
    },
    noName: 'Chưa đặt tên',
    you: 'Bạn',
    responder: 'Người hỗ trợ',
    unverified: 'Chưa xác thực',
    active: 'Hoạt động',
    locked: 'Đã khóa',
    menu: {
      label: (name: string) => `Thao tác với ${name}`,
      makeAdmin: 'Cấp quyền quản trị',
      makeUser: 'Chuyển về người dùng',
      lock: 'Khóa tài khoản',
      unlock: 'Mở khóa',
      self: 'Đây là tài khoản của bạn'
    },
    empty: 'Không tìm thấy tài khoản nào.',
    prev: 'Trước',
    next: 'Sau',
    page: (from: number, to: number, total: number) => `${from}–${to} trên ${total}`,
    confirmRole: {
      title: (name: string, role: string) => `Đổi ${name} thành ${role}?`,
      toAdmin:
        'Quản trị viên chỉ dùng được khu quản trị: đổi vai trò, khóa tài khoản, quản lý người hỗ trợ. Họ sẽ không dùng được các tính năng của người dùng (SOS, trợ lý…) bằng tài khoản này.',
      toUser: 'Tài khoản này sẽ mất quyền vào khu quản trị.',
      confirm: 'Đổi vai trò'
    },
    confirmLock: {
      title: (name: string) => `Khóa tài khoản ${name}?`,
      body: 'Tài khoản sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập được nữa. Nếu là người hỗ trợ, họ sẽ ngừng nhận yêu cầu ngay.',
      confirm: 'Khóa tài khoản'
    },
    confirmBulkLock: {
      title: (n: number) => `Khóa ${n} tài khoản?`,
      body: 'Các tài khoản này sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập được nữa.',
      confirm: 'Khóa tất cả'
    }
  },
  responders: {
    views: {
      all: 'Tất cả',
      pending: 'Chờ duyệt',
      online: 'Đang trực',
      suspended: 'Tạm ngưng'
    },
    search: 'Tìm tên, số điện thoại',
    pending: 'Chờ duyệt',
    appliedOn: (date: string) => `Gửi đăng ký ${date}`,
    noCourses: 'Chưa hoàn thành khóa nào',
    columns: {
      name: (n: number) => `Người hỗ trợ (${n})`,
      phone: 'SĐT liên hệ',
      account: 'Tài khoản',
      skills: 'Kỹ năng',
      status: 'Trạng thái',
      source: 'Khóa học đã hoàn thành'
    },
    noAccount: 'Đăng ký bằng mã quản trị',
    online: 'Đang trực',
    offline: 'Không trực',
    verified: 'Đã xác minh',
    suspended: 'Tạm ngưng',
    menu: {
      label: (name: string) => `Thao tác với ${name}`,
      approve: 'Duyệt',
      reject: 'Từ chối',
      suspend: 'Tạm ngưng',
      reinstate: 'Kích hoạt lại',
      remove: 'Xóa hồ sơ'
    },
    empty: 'Chưa có ai đăng ký làm người hỗ trợ.',
    confirmReject: {
      title: (name: string) => `Từ chối đăng ký của ${name}?`,
      body: 'Đăng ký bị xóa. Các khóa học họ đã hoàn thành vẫn được giữ, nên họ có thể gửi đăng ký lại sau.',
      confirm: 'Từ chối'
    },
    noMatch: 'Không có người hỗ trợ nào khớp.',
    confirmSuspend: {
      title: (name: string) => `Tạm ngưng ${name}?`,
      body: 'Người này sẽ ngừng trực ngay, không nhận yêu cầu mới, và yêu cầu họ đang nhận (nếu có) sẽ bị hủy. Có thể kích hoạt lại sau.',
      confirm: 'Tạm ngưng'
    },
    confirmBulkSuspend: {
      title: (n: number) => `Tạm ngưng ${n} người hỗ trợ?`,
      body: 'Họ sẽ ngừng trực ngay và không nhận yêu cầu mới. Có thể kích hoạt lại sau.',
      confirm: 'Tạm ngưng tất cả'
    },
    confirmRemove: {
      title: (name: string) => `Xóa hồ sơ người hỗ trợ ${name}?`,
      body: 'Hồ sơ người hỗ trợ sẽ bị xóa vĩnh viễn và không khôi phục được. Tài khoản đăng nhập của họ (nếu có) vẫn giữ nguyên.',
      confirm: 'Xóa hồ sơ'
    }
  },
  bulk: {
    selected: (n: number) => `Đã chọn ${n}`,
    lock: 'Khóa',
    unlock: 'Mở khóa',
    suspend: 'Tạm ngưng',
    reinstate: 'Kích hoạt lại',
    approve: 'Duyệt',
    clear: 'Bỏ chọn',
    selectAll: 'Chọn tất cả',
    selectRow: (name: string) => `Chọn ${name}`
  },
  skills: {
    FIRST_AID: 'Sơ cứu',
    CPR: 'CPR',
    AED: 'AED',
    PEDIATRIC: 'Trẻ em'
  } as Record<string, string>,
  courses: {
    title: 'Quản lý khóa học',
    lede: 'Cập nhật sau.'
  },
  account: {
    title: 'Tài khoản của tôi'
  },
  cancel: 'Hủy',
  errors: {
    load: 'Không tải được dữ liệu. Hãy thử lại.',
    self: 'Bạn không thể đổi vai trò hoặc khóa chính tài khoản của mình.',
    forbidden: 'Bạn không còn quyền quản trị.',
    notFound: 'Không tìm thấy, có thể đã bị xóa. Danh sách đã được tải lại.',
    partial: (failed: number) => `${failed} thao tác không thành công. Danh sách đã được tải lại.`,
    generic: 'Có lỗi xảy ra. Hãy thử lại.'
  }
}
