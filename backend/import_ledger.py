"""One-time importer: parse the LOCAL application ledger markdown into the DB.

Run it locally (it needs your local ledger file + your Neon DATABASE_URL):

    cd backend
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    DATABASE_URL='postgresql://...neon.tech/neondb?sslmode=require' \
      LEDGER_PATH='/Users/lc/workspace/jd-based-resume/application_log.md' \
      python import_ledger.py

Only the "Library resumes" (submitted) section is read. Full data goes into the
PRIVATE DB; the public /summary endpoint only ever returns counts.
"""

import datetime
import os
import re

from db import Base, SessionLocal, engine
from models import Application

LEDGER_PATH = os.environ.get(
    "LEDGER_PATH", "/Users/lc/workspace/jd-based-resume/application_log.md"
)


def _clean(cell: str) -> str:
    # strip strikethrough, emoji/non-ascii, stray backslashes
    return re.sub(r"[^\x00-\x7F]", "", cell.replace("~~", "").replace("\\", "")).strip()


def parse(md: str) -> list[dict]:
    library = md.split("## Active batch")[0]  # exclude the staged (not-yet-submitted) batch
    rows: list[dict] = []
    for line in library.splitlines():
        if not re.match(r"^\|\s*~*\d+~*\s*\|", line):
            continue
        cells = line.replace("\\|", "/").split("|")  # neutralize escaped pipes in role text
        app_num = _clean(cells[1])
        if not app_num:
            continue
        applied = _clean(cells[5])
        status = re.sub(r"[^A-Za-z ]", "", _clean(cells[6])).strip() or "Applied"
        applied_date = (
            datetime.date.fromisoformat(applied)
            if re.match(r"^\d{4}-\d{2}-\d{2}$", applied)
            else None
        )
        rows.append(
            dict(
                app_num=int(app_num),
                company=_clean(cells[2]),
                role=_clean(cells[3]),
                resume=_clean(cells[4]),
                applied_date=applied_date,
                status=status,
                notes=_clean(cells[7]) if len(cells) > 7 else "",
            )
        )
    return rows


def main() -> None:
    if engine is None or SessionLocal is None:
        raise SystemExit("Set DATABASE_URL (your Neon connection string) and retry.")
    Base.metadata.create_all(engine)
    with open(LEDGER_PATH, encoding="utf-8") as f:
        rows = parse(f.read())
    with SessionLocal() as session:
        session.query(Application).delete()
        for row in rows:
            session.add(Application(**row))
        session.commit()
    print(f"imported {len(rows)} applications from {LEDGER_PATH}")


if __name__ == "__main__":
    main()
