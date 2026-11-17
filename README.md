# SOS NOW — Sơ cứu khẩn cấp

[![frontend-ci](https://github.com/esmarch-sos-now/esmarch/actions/workflows/frontend-ci.yml/badge.svg?branch=dev)](https://github.com/esmarch-sos-now/esmarch/actions/workflows/frontend-ci.yml)
![python](https://img.shields.io/badge/python-3.14%20%7C%203.15-blue)
![node](https://img.shields.io/badge/node-24%20%7C%2026-339933)
![next.js](https://img.shields.io/badge/Next.js-16-black)
![postgres](https://img.shields.io/badge/PostgreSQL-18-336791)

Phát triển bởi **ESMARCH**

Ý tưởng chính là giúp người chứng kiến **không còn lúng túng** khi có sự cố: một chạm để gọi trợ giúp, giọng nói AI hướng dẫn sơ cứu từng bước, và chỉ đường đến cơ sở y tế gần nhất.

Hiện tại hỗ trợ:

- SOS khẩn cấp: gọi nhanh 115 hoặc hotline bệnh viện gần nhất, chia sẻ vị trí
- AI Voice: trợ lý giọng nói tiếng Việt hướng dẫn sơ cứu theo thời gian thực
- Hướng dẫn sơ cứu từng bước (kèm mô phỏng 3D)
- Bản đồ cơ sở y tế và máy AED gần bạn
- Hai khóa học sơ cứu bằng video của Bệnh viện Hoàn Mỹ Đà Nẵng (phải xem ít nhất 90% video ngay trên trang, không tua nhanh, thì quiz mới mở; sai 2 lần liên tiếp phải xem lại video; hoàn thành được ghi lên hồ sơ; chỉ mở cho tài khoản đã đăng ký làm người hỗ trợ)

Trước đây: khi có người bất tỉnh, hóc dị vật hay đột quỵ, bạn phải tự tìm số điện thoại, tra cách sơ cứu trên mạng và hỏi đường đến bệnh viện, trong khi từng phút đều quý giá.

Với SOS NOW: mở ứng dụng, nhấn nút **SOS**. Ứng dụng định vị bạn, kết nối 115 hoặc cơ sở y tế gần nhất, và AI đọc từng bước sơ cứu trong lúc chờ xe cấp cứu.

> SOS NOW **không thay thế** việc gọi 115. Khi có nguy hiểm tính mạng, hãy luôn gọi 115 trước.

## Cấu trúc repo

| Thư mục | Công nghệ | Mô tả |
| ------- | --------- | ----- |
| `FrontEnd/` | Next.js 16, React 19, SWR, Mapbox GL JS | Landing page và ứng dụng web (`/app/sos`, `/app/tro-ly`, `/app/huong-dan`, `/app/co-so-y-te`) |
| `BackEnd/` | FastAPI, SQLModel, Alembic, PostgreSQL 18 | API cơ sở y tế, AED, hướng dẫn, hỗ trợ và voice WebSocket (`/api/voice/ws`) |
| `archieved/` | Spring Boot, Vite | Các repo cũ, giữ lại để tham khảo |

## Cài đặt và chạy

Chỉ cần [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
cp FrontEnd/.env.example FrontEnd/.env   # điền NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN để hiện bản đồ
cp BackEnd/.env.example BackEnd/.env     # điền OPENAI_API_KEY để bật trợ lý giọng nói
docker compose up -d --build
```

| Dịch vụ | Địa chỉ | Ghi chú |
| ------- | ------- | ------- |
| frontend | http://localhost:3001 | Đổi cổng bằng `FRONTEND_PORT`; chuyển tiếp `/backend/*` sang API |
| backend | http://localhost:8000 | Tài liệu OpenAPI tại `/docs`; migration và seed tự chạy khi khởi động |
| db | localhost:5432 | user / password / db: `esmarch` |

Dùng `docker compose watch` nếu muốn container tự build lại khi đổi dependency hoặc file `.env`.

## Biến môi trường chính

| Biến | File | Dùng để |
| ---- | ---- | ------- |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | `FrontEnd/.env` | Hiện bản đồ (không có thì vẫn xem được danh sách) |
| `OPENAI_API_KEY` | `BackEnd/.env` | Bật trợ lý giọng nói AI |
| `CRON_SECRET` | `BackEnd/.env` | Bí mật cho `GET /api/voice/reap` (cron mỗi phút cúp các cuộc gọi quá hạn) |
| `CLIENT_IP_HEADER` | `BackEnd/.env` | Header chứa IP người gọi do proxy Next gửi (`x-sosnow-client-ip`) |
| `SUPPORT_ADMIN_TOKEN` | `BackEnd/.env` | Bật trang quản trị người hỗ trợ (tối thiểu 32 ký tự ngẫu nhiên) |
| `CORS_ORIGINS` | `BackEnd/.env` | Các origin được gọi API (voice kiểm tra `Origin` theo danh sách này) |
| `SUPPORT_RADIUS_METERS` | `BackEnd/.env` | Bán kính tìm người hỗ trợ, mặc định 3000 m |
| `RESEND_API_KEY`, `MAIL_FROM`, `PUBLIC_SITE_URL` | `BackEnd/.env` | Gửi email kết quả đăng ký người hỗ trợ qua Resend |
| `NEXT_PUBLIC_DEMO_LOCATION` | `FrontEnd/.env` | `true`: hiện ô chọn vị trí giả lập trên trang người hỗ trợ (demo trên một máy) |

Danh sách đầy đủ có trong `FrontEnd/.env.example` và `BackEnd/.env.example`.

## Demo "Tìm kiếm người hỗ trợ"

Người cần giúp mở `/app/nguoi-ho-tro` (không cần đăng nhập), người hỗ trợ mở `/app/san-sang-ho-tro` (cần đăng nhập).
Mọi thao tác đi qua HTTP; trạng thái nằm trong Postgres. Tín hiệu "có thay đổi" đi qua Supabase Realtime, và khi kênh này chưa mở được thì trang tự hỏi lại máy chủ mỗi 3 giây.

**Trên một máy**
1. `FrontEnd/.env`: `NEXT_PUBLIC_DEMO_LOCATION=true`. Cần một tài khoản người hỗ trợ đã được duyệt (xem bước 3).
2. `docker compose up -d --build --renew-anon-volumes`
3. Tab 1: đăng nhập → `/app/san-sang-ho-tro` → **Bắt đầu học** và học hết các bài → **Gửi đăng ký**. Một tài khoản
   quản trị duyệt ở khu quản trị (Người hỗ trợ → Chờ duyệt). Sau đó chọn vị trí giả lập "Thảo Cầm Viên", bấm
   **Bật sẵn sàng**.
4. Tab 2: `/app/nguoi-ho-tro` → chọn "Chợ Bến Thành", nhập số điện thoại, tình huống, ảnh → **Gửi tín hiệu**.
5. Tab 1 kêu và hiện yêu cầu → **Nhận** → thấy số điện thoại, ảnh, dẫn đường. Tab 2 thấy người hỗ trợ và khoảng cách cập nhật trực tiếp.

**Trên hai điện thoại**: trình duyệt chỉ cho lấy vị trí và chụp ảnh qua HTTPS. Mở tunnel HTTPS (vd. `cloudflared tunnel --url http://localhost:3001` và một tunnel nữa cho `http://localhost:8000`), thêm địa chỉ tunnel frontend vào `CORS_ORIGINS`, rồi build lại. Cập nhật trực tiếp dùng Supabase Realtime (cần `SUPABASE_SERVICE_KEY` ở backend), nếu không có thì trang tự hỏi lại mỗi 3 giây.

Giới hạn của bản web: người hỗ trợ phải đang mở trang mới nhận được tín hiệu (đóng tab hoặc tắt màn hình là mất kết nối). Nhận tín hiệu khi đã đóng tab cần Web Push, dự kiến ở giai đoạn 2.

## Trang quản trị (`/admin`)

Tài khoản nằm ở Supabase Auth. Backend giữ vai trò (USER/ADMIN) và trạng thái khóa của từng tài khoản trong bảng `accounts`. Một tài khoản xuất hiện ở đây sau lần đầu đăng nhập trên web. Backend kiểm tra vai trò và trạng thái khóa trong database ở mọi request, không tin claim trong token.

Tạo admin đầu tiên (tài khoản phải đăng nhập trên web ít nhất một lần):

```bash
docker compose exec backend python -m app.modules.admin.promote 0912345678
```

Khi khóa tài khoản, backend từ chối ngay mọi request của tài khoản đó và người hỗ trợ bị đưa khỏi ca trực. Nếu có `SUPABASE_SERVICE_KEY`, Supabase cũng cấm tài khoản đăng nhập lại, và vai trò được chép vào `app_metadata` để trình duyệt chuyển tài khoản admin vào `/admin`. Bản chép này chỉ dùng để chuyển trang.

## Deploy lên Vercel

Hai project trên Vercel cùng trỏ vào repo này: `BackEnd` (preset FastAPI) và `FrontEnd` (Next.js), nhánh production là `main`.

Migration tự chạy khi deploy: Vercel chạy `python -m app.deploy` (khai báo ở `[tool.vercel.scripts]` trong `BackEnd/pyproject.toml`) sau khi cài dependency và trước khi bản mới nhận traffic. Script chạy `alembic upgrade head` rồi nạp seed, có advisory lock để hai bản build không migrate cùng lúc. Migration lỗi thì build lỗi, bản cũ vẫn chạy.

- Chỉ chạy ở bản production. Bản preview bỏ qua, để migration chưa merge không đụng vào database production (đặt `MIGRATE_ON_PREVIEW=true` nếu preview có database riêng).
- `DATABASE_URL`: chuỗi kết nối Supabase qua transaction pooler (cổng 6543) cho runtime. `DATABASE_URL_UNPOOLED`: kết nối trực tiếp hoặc session pooler (cổng 5432) cho migration. Dán nguyên chuỗi `postgresql://...` từ Supabase là được, backend tự đổi sang driver psycopg.

Docker local cũng dùng script này khi container khởi động.

## Trợ lý giọng nói (chạy được trên serverless)

Âm thanh, phụ đề và các lệnh gọi công cụ của model đi thẳng giữa trình duyệt và OpenAI qua WebRTC. Máy chủ chỉ trả lời các request HTTP ngắn và không giữ kết nối nào, nên chạy được trên Vercel Functions:

- `POST /api/voice/calls`: nhận SDP offer và mở phiên GPT-Live. Endpoint này giới hạn số cuộc gọi đồng thời và số cuộc mới theo IP, rồi trả về `token` riêng cho cuộc gọi.
- `POST /api/voice/calls/{id}/tools`: trình duyệt chuyển lại các lệnh gọi công cụ. Máy chủ chạy công cụ theo trạng thái lưu trong Postgres, rồi tự gửi kết quả cho OpenAI qua một sideband mở trong chưa tới 1 giây.
- `nudge` (lời chào, hỏi thăm, báo sắp hết giờ), `step`, `heartbeat`, `end`: lời nói do máy chủ chọn; trình duyệt chỉ báo "đến lúc".
- `GET /api/voice/reap` (cần `Authorization: Bearer $CRON_SECRET`): cúp các cuộc gọi quá `VOICE_SESSION_SECONDS`, các cuộc mà trình duyệt ngừng gửi heartbeat, và các cuộc đã bàn giao xong. Mỗi cuộc gọi mới cũng tự chạy bước này.

Bảo mật: trình duyệt không gửi được gì lên OpenAI (`allowed_client_events: []`, OpenAI trả `event_not_allowed`). Trình duyệt cũng không nhận được cấu hình phiên (instructions, tools). API key chỉ nằm ở máy chủ. Khi cuộc gọi kết thúc, dữ liệu cuộc gọi trong DB bị xóa.

Lịch chạy reaper mỗi phút:
- Vercel **Pro**: thêm cron `* * * * *` gọi `/api/voice/reap`. Gói Hobby chỉ cho cron chạy mỗi ngày một lần.
- Gói nào cũng dùng được: Supabase `pg_cron` + `pg_net`
  ```sql
  select cron.schedule('voice-reap', '* * * * *', $$
    select net.http_get(url := 'https://<backend>/api/voice/reap',
                        headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'))
  $$);
  ```

Khi trình duyệt biến mất, OpenAI tự đóng phiên trong vài giây (đã kiểm tra). Cron vẫn cần cho hai việc: chặn trình duyệt cố giữ kết nối quá giờ, và giải phóng chỗ trong giới hạn số cuộc gọi.

## Kiểm tra code

```bash
# Backend (cần service db đang chạy)
cd BackEnd
uv run pytest
uv run pyrefly check
uv run ruff check .

# Frontend
cd FrontEnd
npm run typecheck
npm run lint
```

Dữ liệu mẫu nằm trong `BackEnd/data/seeds/*.json`, được nạp bằng `python -m app.seeds` (chạy lại nhiều lần không bị trùng).

## Đóng góp

```
feat/xxx ──PR──▶ dev ──PR──▶ main
```

Không push thẳng vào `dev` hoặc `main`. Xem chi tiết trong [CONTRIBUTING.md](CONTRIBUTING.md).

## Giấy phép

Bản quyền © 2026 ESMARCH. Mọi quyền được bảo lưu.

Repo được công khai để xem, nhưng **không phải mã nguồn mở**. Không được sao chép, chỉnh sửa, phân phối hay triển khai mã nguồn khi chưa có sự đồng ý bằng văn bản của ESMARCH. Xem chi tiết trong [LICENSE](LICENSE). Mã của bên thứ ba (thư mục `Archieved/`, thư viện đi kèm và các dependency) giữ nguyên giấy phép riêng của chúng.
