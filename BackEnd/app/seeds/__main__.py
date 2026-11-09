"""Usage: python -m app.seeds"""

import logging

from sqlmodel import Session

from app.core.db import get_engine
from app.seeds.run import run_all

logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    with Session(get_engine()) as session:
        result = run_all(session)
    logging.getLogger("seed").info("Seeded: %s", result or "nothing (no seed files found)")
