"""One-time importer: load web/content/leetcode.json into the DB.

Run locally with your DATABASE_URL (from backend/.env):

    cd backend && source .venv/bin/activate && python import_leetcode.py
"""

import json
import os

from db import Base, SessionLocal, engine
from models import LeetcodeProblem

PATH = os.environ.get(
    "LEETCODE_PATH", "/Users/lc/workspace/lia-til/web/content/leetcode.json"
)


def main() -> None:
    if engine is None or SessionLocal is None:
        raise SystemExit("Set DATABASE_URL (your Neon connection string) and retry.")
    Base.metadata.create_all(engine)
    with open(PATH, encoding="utf-8") as f:
        data = json.load(f)
    with SessionLocal() as session:
        session.query(LeetcodeProblem).delete()
        for i, p in enumerate(data["problems"]):
            session.add(
                LeetcodeProblem(
                    id=p["id"],
                    seq=i,
                    slug=p["slug"],
                    title=p["title"],
                    topics=p.get("topics", []),
                    ep=p["ep"],
                    difficulty=p["difficulty"],
                    status=p["status"],
                    date=p.get("date"),
                    solution_url=p.get("solutionUrl"),
                )
            )
        session.commit()
    print(f"imported {len(data['problems'])} leetcode problems from {PATH}")


if __name__ == "__main__":
    main()
