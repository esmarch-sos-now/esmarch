from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])

SCENARIOS = [
    {
        "id": "cardiac",
        "title": "Bất tỉnh / Ngừng thở",
        "code": "CPR",
        "steps": ["Kiểm tra phản ứng", "Gọi 115", "Bắt đầu ép ngực 100–120 lần/phút"],
    },
    {
        "id": "choking",
        "title": "Hóc / Nghẹn",
        "code": "Đường thở",
        "steps": ["Khuyến khích ho", "5 vỗ lưng", "5 ép bụng"],
    },
    {
        "id": "stroke",
        "title": "Dấu hiệu đột quỵ",
        "code": "FAST",
        "steps": ["Kiểm tra mặt", "Kiểm tra tay", "Kiểm tra lời nói", "Gọi 115"],
    },
    {
        "id": "bleeding",
        "title": "Chảy máu nhiều",
        "code": "Cầm máu",
        "steps": ["Dùng vải sạch", "Ép trực tiếp", "Gọi 115 nếu chảy nhiều"],
    },
]


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sos-now-api"}


@router.get("/scenarios")
def scenarios() -> list[dict]:
    return SCENARIOS
