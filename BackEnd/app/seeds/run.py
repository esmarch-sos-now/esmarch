import logging
from pathlib import Path

from sqlmodel import Session

from app.core.config import get_settings
from app.modules.aeds import service as aeds
from app.modules.facilities import importer
from app.modules.guides.service import catalog as guides

log = logging.getLogger("seed")


def _present(path: str) -> bool:
    return bool(path) and Path(path).is_file()


def run_all(session: Session) -> dict[str, int]:
    """Validate-then-write each dataset in its own transaction. Missing files are skipped, not errors."""
    s = get_settings()
    done: dict[str, int] = {}
    if _present(s.facilities_data_file):
        rows = importer.load_file(s.facilities_data_file)
        importer.import_verified(session, rows)
        done["facilities"] = len(rows)
    if _present(s.aeds_data_file):
        aeds.load_file(session, s.aeds_data_file)
        done["aeds"] = 1
    if _present(s.guides_data_file):
        guides.load_file(s.guides_data_file, session)
        done["guides"] = 1
    return done
