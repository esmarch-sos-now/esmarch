# Tìm kiếm người hỗ trợ (Support Finder)

Tính năng này kết nối người đang cần giúp đỡ với những tình nguyện viên sơ cứu đã được xác minh ("người hỗ trợ"). Người
cần giúp mô tả tình huống, có thể đính kèm ảnh hoặc video, và mọi người hỗ trợ đang sẵn sàng sẽ nhận được màn hình báo
khẩn cấp giống một cuộc gọi đến. Người hỗ trợ đầu tiên bấm nhận sẽ thấy vị trí chính xác và số điện thoại, đồng thời có
đường đi tới người cần giúp. Người cần giúp thấy ai đang đến và còn cách bao xa.

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

1. Trang xin quyền lấy vị trí (GPS) của trình duyệt. Khu vực xảy ra sự cố (quận/huyện) được suy ra từ vị trí này,
   không có ô chọn khu vực.
2. Người cần giúp nhập số điện thoại để người hỗ trợ gọi lại, chọn tình huống và mô tả bằng **chữ** (hoặc bằng
   **giọng nói** nếu đã cấu hình dịch vụ nhận dạng giọng nói, xem
   [Giọng nói thành chữ](#giọng-nói-thành-chữ-tùy-chọn)). Bản ghi âm chỉ dùng để điền ô mô tả và không được tải lên.
3. Có thể đính kèm tối đa **3 ảnh** và **1 video** (chụp hoặc quay bằng camera, hoặc chọn từ thiết bị). Không bắt buộc.
4. Người cần giúp đồng ý chia sẻ thông tin rồi gửi. Màn hình báo đang liên hệ người hỗ trợ. Khi có người nhận, màn hình
   hiện tên, số điện thoại, các khóa sơ cứu người đó đã hoàn thành, khoảng cách và vị trí cập nhật trực tiếp. Sau
   2 phút chưa có ai nhận, trang gợi ý gọi 115 và hiện cơ sở y tế gần nhất; yêu cầu vẫn còn hiệu lực.

### Người hỗ trợ (`/app/san-sang-ho-tro`, chỉ người hỗ trợ đã xác minh)

1. Người hỗ trợ đã đăng nhập và được xác minh bật **"Sẵn sàng hỗ trợ"**. Trong lúc chờ không cần GPS. Trạng thái sẵn
   sàng được giữ khi tải lại trang.
2. Khi có yêu cầu, màn hình **cuộc gọi khẩn cấp** toàn màn hình xuất hiện kèm chuông: tình huống, khu vực, mô tả của
   người cần giúp, ảnh và video hiện trường, và đồng hồ đếm ngược đến khi yêu cầu hết hạn.
3. **Nhận hỗ trợ** cho thấy vị trí chính xác, số điện thoại của người cần giúp và mở bản đồ chỉ đường. **Bỏ qua** chỉ
   tắt lời mời đối với riêng người hỗ trợ đó.
4. GPS của người hỗ trợ chỉ được đọc và gửi cho người cần giúp sau khi đã nhận. Bấm hoàn tất sẽ kết thúc phiên và xoá dữ
   liệu của yêu cầu, kể cả vị trí của người hỗ trợ.

Xem trước màn hình cuộc gọi đến (không có yêu cầu thật): `/app/san-sang-ho-tro?preview=call`.

### Cách chọn người nhận tín hiệu

- Vị trí GPS của người cần giúp được ánh xạ tới quận/huyện gần nhất trong danh mục khu vực cũ của TP.HCM của dự án
  (`FrontEnd/src/lib/support/districts.ts`). Cách này chỉ mang tính ước lượng và dùng cho phần hiển thị và trường `area`
  của yêu cầu.
- Với yêu cầu có `area`, backend mời **mọi người hỗ trợ đang sẵn sàng và đã xác minh** có kỹ năng phù hợp, ở bất kỳ đâu.
  Người hỗ trợ bật sẵn sàng sau khi yêu cầu đã gửi cũng nhận được lời mời.
- API cũ không có `area` vẫn chọn theo bán kính (`SUPPORT_RADIUS_METERS`) quanh vị trí người hỗ trợ đã gửi.
- Lời mời được báo qua Supabase Realtime (tín hiệu "có thay đổi", không chứa dữ liệu cá nhân); trang tải lại dữ liệu
  qua HTTP. Nếu Realtime không kết nối được, trang tự hỏi lại máy chủ mỗi 3 giây. Chưa có thông báo đẩy khi trang đã
  đóng: người hỗ trợ cần giữ trang mở.

## Ai được làm người hỗ trợ

Chỉ người hỗ trợ **đã được xác minh** mới dùng được chế độ này:

- Mục menu **"Chế độ hỗ trợ"** chỉ hiện khi tài khoản đang đăng nhập là người hỗ trợ.
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
| Vị trí của người hỗ trợ | Người cần giúp, chỉ sau khi người hỗ trợ đã nhận | Đến khi yêu cầu kết thúc |

- Yêu cầu nằm trong PostgreSQL; ảnh và video nằm trong bucket **riêng tư** của Supabase Storage. Tất cả bị xoá khi yêu
  cầu hoàn tất, bị huỷ hoặc hết hạn (10 phút).
- Trước khi nhận, người hỗ trợ chỉ thấy tên khu vực (hoặc khoảng cách làm tròn đến 100 m với API theo bán kính).
- Video được tải thẳng từ trình duyệt lên Storage bằng token tải lên có chữ ký; người hỗ trợ xem qua đường dẫn có chữ ký
  chỉ dùng được 5 phút.
- Trạng thái sẵn sàng của người hỗ trợ hết hạn sau 5 phút nếu trang không còn mở để làm mới.
- Người cần giúp không cần tài khoản; mỗi yêu cầu có một token riêng để huỷ, tải tệp và xem trạng thái.

## Kiến trúc

```
Trình duyệt người cần giúp ──HTTP──▶ Next.js (proxy /backend) ──▶ FastAPI /api/support-requests…
        │  ▲                                                          │
        │  └── tín hiệu "có thay đổi" (Supabase Realtime) ◀───────────┤  trạng thái: PostgreSQL
        └── video: tải thẳng lên Supabase Storage (token có chữ ký)   │  ảnh, video: Supabase Storage
Trình duyệt người hỗ trợ ◀── tín hiệu Realtime / HTTP ────────────────┘
```

| Phần | Tệp |
| --- | --- |
| API backend | `BackEnd/app/modules/support/router.py` |
| Chọn người nhận, quy tắc, ảnh và video | `BackEnd/app/modules/support/service.py` |
| Storage, Realtime | `BackEnd/app/core/supabase.py` |
| Model, schema | `BackEnd/app/modules/support/models.py`, `schemas.py` |
| Migration | `BackEnd/migrations/versions/d2b6f1a8c3e5_support_media_and_readiness.py` |
| Màn hình người cần giúp | `FrontEnd/src/components/site/support/requester-screen.tsx`, `incident-report-fields.tsx` |
| Màn hình người hỗ trợ | `FrontEnd/src/components/site/support/responder-screen.tsx`, `incoming-call-overlay.tsx` |
| Bản đồ demo và luồng gọi | `demo-nearby-responders-map*.tsx`, `demo-call-flow.tsx` |
| Hàm dùng phía trình duyệt | `FrontEnd/src/lib/support/` (`protocol.ts`, `asr.ts`, `districts.ts`, `demo-*.ts`), `FrontEnd/src/hooks/useSupportChannel.ts` |
| Kiểm soát truy cập | `FrontEnd/src/lib/auth/paths.ts`, `FrontEnd/src/proxy.ts`, `FrontEnd/src/components/site/landing/Navbar.tsx` |

Proxy của Next.js chuyển các lời gọi `/backend/api/...` của trình duyệt sang backend và tự gắn token của người dùng đang
đăng nhập, nên trình duyệt không giữ token API.

## Tham chiếu API

Mọi đường dẫn nằm dưới `/api`. Các lời gọi của người cần giúp dùng `Authorization: Bearer <requesterToken>` do lời gọi
tạo yêu cầu trả về.

### Người cần giúp

| Phương thức | Đường dẫn | Mục đích |
| --- | --- | --- |
| `POST` | `/support-requests` | Tạo yêu cầu (vị trí, số điện thoại, khu vực, tình huống, mô tả). Trả về mã yêu cầu và `requesterToken`. `409` nếu không có ai đang sẵn sàng. |
| `GET` | `/support-requests/{id}` | Trạng thái hiện tại: tình trạng, số người được mời, số ảnh, có video không, người hỗ trợ đã nhận. |
| `POST` | `/support-requests/{id}/photos` | Đính kèm ảnh (JPEG, PNG hoặc WebP; mặc định tối đa 3 ảnh, mỗi ảnh 4 MB). |
| `POST` | `/support-requests/{id}/video-upload` | Cách tải video lên: `mode: "signed"` kèm `bucket`, `path`, `token` (tải thẳng lên Storage), hoặc `mode: "backend"` khi chạy trên máy không có Storage. |
| `POST` | `/support-requests/{id}/video/complete` | Sau khi tải lên Storage: kiểm tra loại (MP4, WebM, QuickTime) và dung lượng rồi cho người hỗ trợ xem. Tệp không hợp lệ bị xoá. |
| `POST` | `/support-requests/{id}/video` | Tải video qua backend (chỉ khi `mode: "backend"`). |
| `DELETE` | `/support-requests/{id}` | Huỷ yêu cầu. |

### Người hỗ trợ (đã đăng nhập và xác minh)

| Phương thức | Đường dẫn | Mục đích |
| --- | --- | --- |
| `GET` / `POST` | `/support/me` | Hồ sơ, trạng thái sẵn sàng và các khóa đã hoàn thành; đăng ký bị từ chối nếu tự đăng ký đang tắt. |
| `PUT` | `/support/me/availability` | Bật hoặc tắt trạng thái sẵn sàng (không cần toạ độ). |
| `GET` | `/support/me/requests` | Các lời mời đang mở và yêu cầu đang xử lý. |
| `POST` | `/support/me/requests/{id}/accept` | Nhận: trả về vị trí chính xác và số điện thoại. |
| `POST` | `/support/me/requests/{id}/decline` | Bỏ qua lời mời. |
| `POST` | `/support/me/requests/{id}/complete` | Hoàn tất yêu cầu. |
| `POST` | `/support/me/location` | Gửi vị trí của người hỗ trợ sau khi đã nhận. |
| `GET` | `/support/me/requests/{id}/photos/{index}` | Một ảnh hiện trường (người được mời khi yêu cầu còn mở, người đã nhận sau đó). |
| `GET` | `/support/me/requests/{id}/video-url` | Đường dẫn có chữ ký (5 phút) tới video, cùng quy tắc xem như ảnh; `url: null` khi chạy trên máy không có Storage. |
| `GET` | `/support/me/requests/{id}/video` | Video phát qua backend (chỉ khi không có Storage). |

### Tín hiệu Realtime

Kênh `support:responder:<user id>` và `support:request:<request id>` nhận các tín hiệu `request.new`, `request.detail`,
`request.taken`, `request.cancelled`, `request.expired`, `request.completed`, `request.accepted`, `request.invited` và
`responder.location`. Tín hiệu chỉ có `type`; trang tải lại dữ liệu qua HTTP.

## Cấu hình

### Backend (`BackEnd/.env`)

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `SUPPORT_DEMO_SELF_ENROLL` | `false` | Cho phép mọi người dùng đã đăng nhập tự đăng ký làm người hỗ trợ. Chỉ dùng cho demo trên máy. |
| `SUPPORT_RADIUS_METERS` | `3000` | Bán kính tìm kiếm cho yêu cầu theo toạ độ (API cũ, không có `area`). |
| `SUPPORT_MAX_PHOTOS` | `3` | Số ảnh tối đa cho mỗi yêu cầu. |
| `SUPPORT_PHOTO_MAX_BYTES` | `4000000` | Dung lượng ảnh tối đa (dưới giới hạn body của hàm serverless). |
| `SUPPORT_VIDEO_MAX_BYTES` | `26214400` | Dung lượng video tối đa (25 MB). |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | trống | Storage (bucket riêng tư `support-photos`, dùng cho cả ảnh và video) và Realtime. Thiếu thì tệp nằm trong bộ nhớ và trang hỏi lại mỗi 3 giây (chỉ dùng trên máy). |
| `SUPPORT_ADMIN_TOKEN` | trống | Thông tin xác thực cho các API quản trị cũ (từ 32 ký tự). |

Giới hạn dung lượng tệp của bucket trên Supabase phải từ 25 MB trở lên để video tải lên được.

### Frontend (`FrontEnd/.env`)

| Biến | Ý nghĩa |
| --- | --- |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Bản đồ và chỉ đường. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Realtime và tải video thẳng lên Storage. |
| `NEXT_PUBLIC_DEMO_LOCATION` | `true` hiện ô chọn vị trí giả lập và dời người hỗ trợ demo 1 km so với vị trí GPS. |
| `NEXT_PUBLIC_DEMO_RESPONDERS` | `true` làm trang người cần giúp hiện bản đồ mô phỏng 20 người hỗ trợ thay vì gọi backend. |
| `NEXT_PUBLIC_ASR_ENABLED` | `true` hiện nút ghi âm phần mô tả (backend cần `OPENAI_API_KEY`). Để trống thì chỉ nhập bằng chữ. |

Các biến `NEXT_PUBLIC_*` được đóng gói lúc build; hãy khởi động lại dev server sau khi đổi.

### Giọng nói thành chữ (tùy chọn)

Form của người cần giúp có thể điền phần mô tả từ bản ghi âm (tối đa 60 giây). Bản ghi âm gốc của trình duyệt
(WebM/Ogg, hoặc MP4 trên Safari) được gửi tới `POST /api/support/transcribe`; backend gọi OpenAI speech-to-text
(`gpt-transcribe`, tiếng Việt), trả về đoạn chữ và không lưu gì. Endpoint này không cần đăng nhập vì lúc điền form
chưa có yêu cầu nào, nên nó chặn site khác bằng `Origin`, giới hạn 4 MB mỗi bản ghi và 10 bản ghi mỗi IP trong 10 phút.

Cần cả hai: `NEXT_PUBLIC_ASR_ENABLED=true` ở frontend và `OPENAI_API_KEY` ở backend. Thiếu key thì backend trả 503;
bản ghi âm vẫn được giữ và người cần giúp có thể gõ mô tả bằng chữ.

| Biến backend | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `SUPPORT_TRANSCRIBE_MODEL` | `gpt-transcribe` | Model speech-to-text của OpenAI (khoảng $0.0045 mỗi phút âm thanh). |
| `SUPPORT_TRANSCRIBE_MAX_BYTES` | `4000000` | Dung lượng tối đa một bản ghi (dưới giới hạn 4.5 MB của Vercel Functions). |
| `SUPPORT_TRANSCRIBE_PER_IP`, `SUPPORT_TRANSCRIBE_WINDOW_SECONDS` | `10`, `600` | Số bản ghi mỗi IP trong mỗi khoảng thời gian. |

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
   - Đặt `NEXT_PUBLIC_DEMO_RESPONDERS=false` (hoặc để trống) để dùng luồng thật qua backend.
4. Camera, micro và GPS trên điện thoại cần HTTPS: mở site qua tunnel HTTPS và thêm origin vào `CORS_ORIGINS`.

## Kiểm tra

```bash
# Backend (cần service db đang chạy)
cd BackEnd && uv run pytest && uv run ruff check .

# Frontend (giống các bước CI chạy)
cd FrontEnd && npm run typecheck && npm run lint && npm run build
```

Migration: `alembic heads` phải chỉ có đúng một head.

## Giới hạn

- Chưa có thông báo đẩy: người hỗ trợ chỉ nhận lời mời khi trang đang mở.
- Việc suy ra quận/huyện từ GPS chỉ là ước lượng (khoảng cách tới tâm quận, không phải kiểm tra ranh giới).
- Bản ghi âm được chuyển thành chữ nhưng không được tải lên; người hỗ trợ chỉ nhận phần chữ.
- Video tối đa 25 MB và được phát đúng như đã gửi (không chuyển mã).
- Bản đồ mô phỏng (`NEXT_PUBLIC_DEMO_RESPONDERS=true`) không gửi gì tới backend.
