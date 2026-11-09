import re

from sqlmodel import Session, col, select

from app.common.checks import strip_accents
from app.core import clock
from app.modules.facilities.models import Facility

# Legacy district labels for the initial HCMC service area, not an administrative registry.
DISTRICTS = [
    "Quận 1", "Quận 3", "Quận 4", "Quận 5", "Quận 6", "Quận 7", "Quận 8",
    "Quận 10", "Quận 11", "Quận 12", "Bình Tân", "Bình Thạnh", "Gò Vấp",
    "Phú Nhuận", "Tân Bình", "Tân Phú", "Thủ Đức", "Bình Chánh", "Cần Giờ",
    "Củ Chi", "Hóc Môn", "Nhà Bè", "TP. Hồ Chí Minh",
]  # fmt: skip


def _normalize(value: str) -> str:
    key = strip_accents(value.strip().lower())
    key = re.sub(r"^(quan|huyen|thanh pho|tp\.?)\s+", "", key, count=1)
    return re.sub(r"\s+", " ", key)


_BY_KEY = {_normalize(d): d for d in DISTRICTS}


def canonical(value: str | None) -> str | None:
    return None if value is None else _BY_KEY.get(_normalize(value))


def all_districts(session: Session) -> list[str]:
    now = clock.now()
    rows = session.exec(
        select(Facility.district)
        .where(col(Facility.verified_at).is_not(None), col(Facility.verified_at) <= now)
        .distinct()
        .order_by(Facility.district)
    ).all()
    result = list(DISTRICTS)
    result.extend(d for d in rows if d not in result)
    return result
