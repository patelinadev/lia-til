"""One-time importer: load web/content/system-design.json into the DB.

Run locally with your DATABASE_URL (from backend/.env):

    cd backend && source .venv/bin/activate && python import_system_design.py
"""

import json
import os

from db import Base, SessionLocal, engine
from models import SDDeck

PATH = os.environ.get(
    "SD_PATH", "/Users/lc/workspace/lia-til/web/content/system-design.json"
)


def main() -> None:
    if engine is None or SessionLocal is None:
        raise SystemExit("Set DATABASE_URL (your Neon connection string) and retry.")
    Base.metadata.create_all(engine)
    with open(PATH, encoding="utf-8") as f:
        data = json.load(f)
    with SessionLocal() as session:
        session.query(SDDeck).delete()
        for d in data["decks"]:
            session.add(
                SDDeck(
                    slug=d["slug"],
                    n=d["n"],
                    title=d["title"],
                    last_reviewed=d["lastReviewed"],
                    slides=d["slides"],
                )
            )
        session.commit()
    print(f"imported {len(data['decks'])} system-design decks from {PATH}")


if __name__ == "__main__":
    main()
