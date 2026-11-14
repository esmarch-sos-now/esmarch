# Tìm kiếm người hỗ trợ (Support Finder)

Tính năng này kết nối người đang cần giúp đỡ với những tình nguyện viên sơ cứu đã được xác minh ("người hỗ trợ") ở gần
đó. Người cần giúp mô tả tình huống, có thể đính kèm ảnh hoặc video, và mọi người hỗ trợ đang sẵn sàng sẽ nhận được
màn hình báo khẩn cấp giống một cuộc gọi đến. Người hỗ trợ đầu tiên bấm nhận sẽ thấy vị trí chính xác và số điện thoại,
đồng thời có đường đi tới người cần giúp. Người cần giúp thấy ai đang đến và còn cách bao xa.

> Tính năng này bổ sung cho số khẩn cấp **115**, không thay thế. Các màn hình của người cần giúp luôn có nút gọi 115 và
> danh sách cơ sở y tế gần nhất.

## Mục lục

- [Cách hoạt động](#cách-hoạt-động)
- [Ai được làm người hỗ trợ](#ai-được-làm-người-hỗ-trợ)
- [Quy tắc riêng tư](#quy-tắc-riêng-tư)
- [Kiến trúc](#kiến-trúc)
- [Tham chiếu API](#tham-chiếu-api)
- [Cấu hình](#cấu-hình)
- [Chạy trên máy](#chạy-trên-máy)
- [Kiểm tra](#kiểm-tra)
- [Giới hạn](#giới-hạn)

## Cách hoạt động

### Người cần giúp (`/app/nguoi-ho-tro`, không cần tài khoản)

1. Trang xin quyền lấy vị trí (GPS) của trình duyệt. Khu vực xảy ra sự cố được suy ra từ vị trí này, không có ô chọn
   khu vực.
2. Người cần giúp mô tả tình huống bằng **chữ hoặc giọng nói** (cần ít nhất một trong hai). Bản ghi âm được chuyển
   thành chữ trong ô mô tả bằng dịch vụ nhận dạng giọng nói chạy trên máy (xem
   [Giọng nói thành chữ](#giọng-nói-thành-chữ-tùy-chọn)); người dùng có thể sửa trước khi gửi.
3. Có thể đính kèm tối đa **3 ảnh** và **1 video** (chụp hoặc quay bằng camera, hoặc chọn từ thiết bị). Không bắt buộc.
4. Sau khi gửi, màn hình báo đang liên hệ người hỗ trợ. Khi có người nhận, màn hình hiện tên, số điện thoại, khoảng cách
   và vị trí cập nhật trực tiếp. Sau 2 phút chưa có ai nhận, trang gợi ý gọi 115 và hiện cơ sở y tế gần nhất; yêu cầu
   vẫn còn hiệu lực.

### Người hỗ trợ (`/app/san-sang-ho-tro`, chỉ người hỗ trợ đã xác minh)

1. Người hỗ trợ đã đăng nhập và được xác minh bật **"Sẵn sàng hỗ trợ"**. Trong lúc chờ không cần GPS.
2. Khi có yêu cầu, màn hình **cuộc gọi khẩn cấp** toàn màn hình xuất hiện kèm chuông: tình huống, khu vực hoặc khoảng
   cách đã làm tròn, mô tả của người cần giúp, ảnh và video hiện trường, và đồng hồ đếm ngược đến khi yêu cầu hết hạn.
3. **Nhận hỗ trợ** cho thấy vị trí chính xác, số điện thoại của người cần giúp và mở bản đồ chỉ đường. **Bỏ qua** chỉ
   tắt lời mời đối với riêng người hỗ trợ đó.
4. Vị trí của người hỗ trợ chỉ được gửi cho người cần giúp sau khi đã nhận. Bấm hoàn tất sẽ kết thúc phiên và xoá dữ
   liệu của yêu cầu.

### Cách chọn người nhận tín hiệu

- Vị trí GPS của người cần giúp được ánh xạ tới quận/huyện gần nhất trong danh mục khu vực cũ của TP.HCM của dự án
  (`FrontEnd/src/lib/support/districts.ts`). Cách này chỉ mang tính ước lượng và dùng cho phần hiển thị và trường `area`
  của yêu cầu.
- Backend mời **mọi người hỗ trợ đang sẵn sàng và đã xác minh** có kỹ năng phù hợp với yêu cầu. Khu vực do người hỗ trợ
  tự chọn không còn được dùng để ghép.
- Lời mời được đẩy qua WebSocket. Nếu WebSocket không kết nối được, trang tự hỏi lại máy chủ mỗi 3 giây. Có thể bật
  thêm Firebase Cloud Messaging (web push) để báo cho người hỗ trợ khi trang đang chạy nền.

## Ai được làm người hỗ trợ

Chỉ người hỗ trợ **đã được xác minh** mới dùng được chế độ này:

- Mục menu **"Chế độ hỗ trợ"** chỉ hiện khi tài khoản đang đăng nhập là người hỗ trợ đã xác minh.
- `/app/san-sang-ho-tro` là trang cần đăng nhập: người chưa đăng nhập bị chuyển về trang đăng nhập. Tài khoản đã đăng
  nhập nhưng chưa được xác minh chỉ thấy thông báo "chưa được xác minh" thay cho nút bật sẵn sàng.
- Tự đăng ký làm người hỗ trợ **mặc định tắt** (`SUPPORT_DEMO_SELF_ENROLL=false`). Người hỗ trợ do quản trị viên thêm và
  xác minh qua khu vực quản trị / `/api/admin/responders`. Công tắc tự đăng ký chỉ dành cho demo trên máy và tuyệt đối
  không bật trên môi trường thật.

## Quy tắc riêng tư

| Dữ liệu | Ai xem được | Thời gian lưu |
| --- | --- | --- |
| Vị trí chính xác của người cần giúp | Chỉ người hỗ trợ đã nhận | Đến khi yêu cầu kết thúc |
| Số điện thoại của người cần giúp | Chỉ người hỗ trợ đã nhận | Đến khi yêu cầu kết thúc |
| Mô tả, ảnh, video | Người hỗ trợ được mời và chưa bỏ qua khi yêu cầu còn mở; sau khi có người nhận thì chỉ người đó | Đến khi yêu cầu kết thúc |
| Vị trí của người hỗ trợ | Người cần giúp, chỉ sau khi người hỗ trợ đã nhận | Trong lúc yêu cầu còn hiệu lực |

- Yêu cầu, ảnh và video chỉ nằm **trong RAM** (không ghi ra đĩa hay cơ sở dữ liệu) và bị xoá khi yêu cầu hoàn tất, bị huỷ
  hoặc hết hạn (10 phút).
- Trước khi nhận, người hỗ trợ chỉ thấy tên khu vực hoặc khoảng cách làm tròn đến 100 m.
- Trạng thái sẵn sàng của người hỗ trợ hết hạn sau 5 phút nếu trang không còn mở để làm mới.
- Người cần giúp không cần tài khoản; mỗi yêu cầu có một token riêng để huỷ, tải tệp và xem trạng thái.

## Kiến trúc

```
Trình duyệt người cần giúp ──HTTP──▶ Next.js (proxy /backend) ──▶ FastAPI /api/support-requests…
        ▲                                                           │
        │ WebSocket /api/support/ws (dự phòng: hỏi lại mỗi 3 giây)  ▼
Trình duyệt người hỗ trợ ◀──────────────────────────── SupportService (trong bộ nhớ)
        │                                                           │
        └── nhận / bỏ qua / vị trí ─────────────────────────────────┘   người hỗ trợ đã xác minh: PostgreSQL
```

| Phần | Tệp |
| --- | --- |
| API backend | `BackEnd/app/modules/support/router.py` |
| Chọn người nhận, quy tắc, ảnh và video | `BackEnd/app/modules/support/service.py` |
| WebSocket | `BackEnd/app/modules/support/realtime.py` |
| Web push (FCM) | `BackEnd/app/modules/support/push.py` |
| Model, schema | `BackEnd/app/modules/support/models.py`, `schemas.py` |
| Migration | `BackEnd/migrations/versions/` (khu vực, trạng thái sẵn sàng và thiết bị, bản gộp) |
| Màn hình người cần giúp | `FrontEnd/src/components/site/support/requester-screen.tsx`, `incident-report-fields.tsx` |
| Màn hình người hỗ trợ | `FrontEnd/src/components/site/support/responder-screen.tsx`, `incoming-call-overlay.tsx` |
| Bản đồ demo và luồng gọi | `demo-nearby-responders-map*.tsx`, `demo-call-flow.tsx` |
| Hàm dùng phía trình duyệt | `FrontEnd/src/lib/support/` (`protocol.ts`, `asr.ts`, `districts.ts`, `push.ts`, `demo-*.ts`) |
| Kiểm soát truy cập | `FrontEnd/src/lib/auth/paths.ts`, `FrontEnd/src/proxy.ts`, `FrontEnd/src/components/site/landing/Navbar.tsx` |

Proxy của Next.js chuyển các lời gọi `/backend/api/...` của trình duyệt sang backend và tự gắn token của người dùng đang
đăng nhập, nên trình duyệt không giữ token API.

## Tham chiếu API

Mọi đường dẫn nằm dưới `/api`. Các lời gọi của người cần giúp dùng `Authorization: Bearer <requesterToken>` do lời gọi
tạo yêu cầu trả về.

### Người cần giúp

| Phương thức | Đường dẫn | Mục đích |
| --- | --- | --- |
| `POST` | `/support-requests` | Tạo yêu cầu (vị trí, số điện thoại, khu vực, mô tả). Trả về mã yêu cầu và `requesterToken`. `409` nếu không có ai để mời. |
| `GET` | `/support-requests/{id}` | Trạng thái hiện tại: tình trạng, số người được mời, số ảnh/video, người hỗ trợ đã nhận. |
| `POST` | `/support-requests/{id}/photos` | Đính kèm ảnh (JPEG, PNG hoặc WebP; mặc định tối đa 3 ảnh, mỗi ảnh 5 MB). |
| `POST` | `/support-requests/{id}/video` | Đính kèm 1 video (MP4, WebM hoặc QuickTime; mặc định tối đa 25 MB). |
| `DELETE` | `/support-requests/{id}` | Huỷ yêu cầu. |

### Người hỗ trợ (đã đăng nhập và xác minh)

| Phương thức | Đường dẫn | Mục đích |
| --- | --- | --- |
| `GET` / `POST` | `/support/me` | Hồ sơ và trạng thái đăng ký (`enrolled`, `selfEnrollEnabled`). Đăng ký bị từ chối nếu tự đăng ký đang tắt. |
| `PUT` | `/support/me/availability` | Bật hoặc tắt trạng thái sẵn sàng. |
| `POST` | `/support/ws-ticket` | Vé ngắn hạn để bắt tay WebSocket. |
| `GET` | `/support/me/requests` | Các lời mời đang mở và yêu cầu đang xử lý (dự phòng khi không có WebSocket). |
| `POST` | `/support/me/requests/{id}/accept` | Nhận: trả về vị trí chính xác và số điện thoại. |
| `POST` | `/support/me/requests/{id}/decline` | Bỏ qua lời mời. |
| `POST` | `/support/me/requests/{id}/complete` | Hoàn tất yêu cầu. |
| `POST` | `/support/me/location` | Gửi vị trí của người hỗ trợ sau khi đã nhận. |
| `GET` | `/support/me/requests/{id}/photos/{index}` | Một ảnh hiện trường (người được mời khi yêu cầu còn mở, người đã nhận sau đó). |
| `GET` | `/support/me/requests/{id}/video` | Video hiện trường, cùng quy tắc xem như ảnh. |
| `PUT` / `DELETE` | `/support/me/devices` | Đăng ký hoặc gỡ thiết bị nhận web push. |

### WebSocket

`/api/support/ws` truyền các thông điệp `request.new`, `request.detail`, `request.taken`, `request.cancelled`,
`request.expired`, `request.completed`, `availability` và `ready`. Giá trị `Origin` khi bắt tay phải nằm trong
`CORS_ORIGINS`.

## Cấu hình

### Backend (`BackEnd/.env`)

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `SUPPORT_DEMO_SELF_ENROLL` | `false` | Cho phép mọi người dùng đã đăng nhập tự đăng ký làm người hỗ trợ. Chỉ dùng cho demo trên máy. |
| `SUPPORT_RADIUS_METERS` | `3000` | Bán kính tìm kiếm cho yêu cầu theo toạ độ. |
| `SUPPORT_MAX_PHOTOS` | `3` | Số ảnh tối đa cho mỗi yêu cầu. |
| `SUPPORT_PHOTO_MAX_BYTES` | `5242880` | Dung lượng ảnh tối đa. |
| `SUPPORT_VIDEO_MAX_BYTES` | `26214400` | Dung lượng video tối đa (25 MB). |
| `SUPPORT_ADMIN_TOKEN` | trống | Thông tin xác thực cho các API quản trị cũ (từ 32 ký tự). |
| `FCM_SERVICE_ACCOUNT_JSON` | trống | Tài khoản dịch vụ Firebase cho web push (không bắt buộc). |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` | Các origin trình duyệt được phép, gồm cả bắt tay WebSocket. |

### Frontend (`FrontEnd/.env`)

| Biến | Ý nghĩa |
| --- | --- |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Bản đồ và chỉ đường. |
| `NEXT_PUBLIC_SUPPORT_WS_URL` | Địa chỉ WebSocket khi chạy qua tunnel hoặc HTTPS. |
| `NEXT_PUBLIC_DEMO_LOCATION` | `true` hiện ô chọn vị trí giả lập và dời người hỗ trợ demo 1 km so với vị trí GPS. |
| `NEXT_PUBLIC_DEMO_RESPONDERS` | `true` làm trang người cần giúp hiện bản đồ mô phỏng 20 người hỗ trợ thay vì gọi backend. |
| `NEXT_PUBLIC_ASR_URL` | Địa chỉ dịch vụ giọng nói thành chữ chạy trên máy (mặc định `http://127.0.0.1:7860/api/transcribe`). |
| `NEXT_PUBLIC_FIREBASE_*` | Cấu hình Firebase web cho push (`API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `MESSAGING_SENDER_ID`, `APP_ID`, `VAPID_KEY`). |
| `SESSION_COOKIE_SUFFIX` | Phía máy chủ. Cho mỗi site bộ cookie đăng nhập riêng; xem bên dưới. |

Các biến `NEXT_PUBLIC_*` được đóng gói lúc build; hãy khởi động lại dev server sau khi đổi.

### Giọng nói thành chữ (tùy chọn)

Form của người cần giúp có thể điền phần mô tả từ bản ghi âm. Âm thanh WAV 16 kHz đơn kênh được gửi tới một dịch vụ chạy
**trên máy** (`NEXT_PUBLIC_ASR_URL`); âm thanh không rời khỏi máy. Dịch vụ này không nằm trong repo. Nếu dịch vụ chưa
chạy, bản ghi âm vẫn được giữ và người cần giúp có thể gõ mô tả bằng chữ.

## Chạy trên máy

```bash
docker compose up -d --build        # frontend :3001, backend :8000, cơ sở dữ liệu
```

1. Mở ứng dụng bằng **`localhost`**, không dùng `127.0.0.1`: dev server chặn địa chỉ này nên trang không tải xong và
   trình duyệt không bao giờ xin vị trí.
2. Người hỗ trợ: đăng nhập bằng tài khoản người hỗ trợ đã xác minh và mở `/app/san-sang-ho-tro`. Với môi trường thử tạm
   trên máy, đặt `SUPPORT_DEMO_SELF_ENROLL=true` trong `BackEnd/.env` rồi tạo lại backend
   (`docker compose up -d --no-deps backend`; khởi động lại thông thường không đọc lại `.env`).
3. Người cần giúp: mở `/app/nguoi-ho-tro` ở một hồ sơ trình duyệt khác hoặc cửa sổ ẩn danh.
   - Đặt `NEXT_PUBLIC_DEMO_RESPONDERS=false` trên site của người cần giúp để dùng luồng thật qua backend.
4. Trình duyệt dùng chung cookie giữa các cổng của cùng một host. Để chạy site người cần giúp và người hỗ trợ trên hai
   cổng của `localhost` mà đăng nhập tách biệt, hãy chạy site thứ hai với `SESSION_COOKIE_SUFFIX=requester`.
5. Camera, micro và GPS trên điện thoại cần HTTPS: mở các site qua tunnel HTTPS, thêm origin của chúng vào
   `CORS_ORIGINS` và đặt địa chỉ WebSocket vào `NEXT_PUBLIC_SUPPORT_WS_URL`.

## Kiểm tra

```bash
# Backend (cần service db đang chạy)
cd BackEnd && uv run pytest && uv run ruff check .

# Frontend (giống các bước CI chạy)
cd FrontEnd && npm run typecheck && npm run lint && npm run build
```

Migration: `alembic upgrade head` phải kết thúc ở đúng một head. Các migration của tính năng này được gộp với migration
số điện thoại/vai trò bằng tệp `*_merge_support_finder_and_admin_migrations.py`.

## Giới hạn

- Yêu cầu và tệp đính kèm nằm trong bộ nhớ của một backend duy nhất. Chạy nhiều bản cần kho dữ liệu dùng chung.
- Người hỗ trợ chỉ nhận lời mời khi trang đang mở (hoặc qua web push nếu đã cấu hình FCM).
- Việc suy ra quận/huyện từ GPS chỉ là ước lượng (khoảng cách tới tâm quận, không phải kiểm tra ranh giới).
- Bản ghi âm được chuyển thành chữ nhưng không được tải lên; người hỗ trợ chỉ nhận phần chữ.
- Video tối đa 25 MB và được phát đúng như đã gửi (không chuyển mã hay phát trực tuyến).
- Bản đồ mô phỏng (`NEXT_PUBLIC_DEMO_RESPONDERS=true`) không gửi gì tới backend.
