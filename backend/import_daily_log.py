"""One-time importer: load the curated daily-log JSON into the DB.

Reads web/content/log/*.json (the CURATED public entries — no private sections)
and upserts them into the daily_logs table. Run locally with your DATABASE_URL
(from backend/.env):

    cd backend && source .venv/bin/activate && python import_daily_log.py
"""

import glob
import json
import os

from db import Base, SessionLocal, engine
from models import DailyLog

LOG_DIR = os.environ.get(
    "LOG_DIR", "/Users/lc/workspace/lia-til/web/content/log"
)


def main() -> None:
    if engine is None or SessionLocal is None:
        raise SystemExit("Set DATABASE_URL (your Neon connection string) and retry.")
    Base.metadata.create_all(engine)
    files = sorted(glob.glob(os.path.join(LOG_DIR, "*.json")))
    entries = [json.load(open(f, encoding="utf-8")) for f in files]
    with SessionLocal() as session:
        session.query(DailyLog).delete()
        for e in entries:
            session.add(
                DailyLog(
                    date=e["date"],
                    week=e.get("week", ""),
                    done=e.get("done", []),
                    summary=e.get("summary"),
                    note=e.get("note"),
                    leetcode=e.get("leetcode", []),
                )
            )
        session.commit()
    print(f"imported {len(entries)} daily-log entries from {LOG_DIR}")


if __name__ == "__main__":
    main()
