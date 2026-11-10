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
- Khóa học và quiz sơ cứu

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
| `NEXT_PUBLIC_VOICE_WS_URL` | `FrontEnd/.env` | Địa chỉ WebSocket của trợ lý giọng nói khi chạy qua tunnel |
| `OPENAI_API_KEY` | `BackEnd/.env` | Bật trợ lý giọng nói AI |
| `SUPPORT_ADMIN_TOKEN` | `BackEnd/.env` | Bật trang quản trị người hỗ trợ (tối thiểu 32 ký tự ngẫu nhiên) |
| `CORS_ORIGINS` | `BackEnd/.env` | Các origin được gọi API và mở voice WebSocket |

Danh sách đầy đủ có trong `FrontEnd/.env.example` và `BackEnd/.env.example`.

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
