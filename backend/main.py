"""lia-til API — FastAPI backend (Phase 2 · S1).

Public endpoints only. The applications table holds full private data, but this
service exposes ONLY aggregate counts (no company names, roles, salaries).
Private full views come later behind auth (S2).
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from sqlalchemy import func, select

from db import Base, SessionLocal, engine
from models import Application, DailyLog, LeetcodeProblem, SDDeck

LEETCODE_TRACK = "0x3f Basic Algorithms"
LEETCODE_TRACK_URL = "https://space.bilibili.com/206214/channel/collectiondetail?sid=842776"

# Shared secret for the private endpoints. The site's server (never the browser)
# sends it after it has verified the admin's session. Set BACKEND_SECRET on Render.
ADMIN_SECRET = os.environ.get("BACKEND_SECRET")


def require_admin(x_admin_secret: Optional[str] = Header(default=None)) -> None:
    """Gate a private endpoint: reject unless the shared secret matches. If the
    secret isn't configured at all, the private endpoints stay closed."""
    if not ADMIN_SECRET or x_admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Ensure the table exists so /summary never errors before the first import.
    if engine is not None:
        Base.metadata.create_all(engine)
    yield


app = FastAPI(title="lia-til API", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/applications/summary")
def applications_summary():
    """Anonymized aggregates: total, per-status counts, per-day counts."""
    if SessionLocal is None:
        return {"updatedAt": None, "totalSubmitted": 0, "byStatus": {}, "byDate": []}

    with SessionLocal() as session:
        total = session.scalar(select(func.count()).select_from(Application)) or 0

        by_status = {
            status: count
            for status, count in session.execute(
                select(Application.status, func.count()).group_by(Application.status)
            ).all()
        }

        by_date = [
            {"date": day.isoformat(), "count": count}
            for day, count in session.execute(
                select(Application.applied_date, func.count())
                .where(Application.applied_date.isnot(None))
                .group_by(Application.applied_date)
                .order_by(Application.applied_date)
            ).all()
        ]

    return {
        "updatedAt": by_date[-1]["date"] if by_date else None,
        "totalSubmitted": total,
        "byStatus": by_status,
        "byDate": by_date,
    }


@app.get("/api/applications/full", dependencies=[Depends(require_admin)])
def applications_full():
    """PRIVATE — full per-company ledger rows. Only reachable with the shared
    secret; the public site gates this behind the admin's GitHub session."""
    if SessionLocal is None:
        return {"applications": []}
    with SessionLocal() as session:
        rows = (
            session.execute(select(Application).order_by(Application.app_num))
            .scalars()
            .all()
        )
        apps = [
            {
                "appNum": r.app_num,
                "company": r.company,
                "role": r.role,
                "resume": r.resume,
                "appliedDate": r.applied_date.isoformat() if r.applied_date else None,
                "status": r.status,
                "notes": r.notes,
            }
            for r in rows
        ]
    return {"total": len(apps), "applications": apps}


@app.get("/api/leetcode")
def leetcode():
    """Solved problems in 0x3f plan order (episode, then plan order within it)."""
    if SessionLocal is None:
        return {"track": LEETCODE_TRACK, "trackUrl": LEETCODE_TRACK_URL, "updatedAt": None, "problems": []}
    with SessionLocal() as session:
        rows = (
            session.execute(select(LeetcodeProblem).order_by(LeetcodeProblem.seq))
            .scalars()
            .all()
        )
        problems = [
            {
                "id": r.id,
                "slug": r.slug,
                "title": r.title,
                "topics": r.topics or [],
                "ep": r.ep,
                "difficulty": r.difficulty,
                "status": r.status,
                "date": r.date,
                "solutionUrl": r.solution_url,
            }
            for r in rows
        ]
    dates = sorted(p["date"] for p in problems if p["date"])
    return {
        "track": LEETCODE_TRACK,
        "trackUrl": LEETCODE_TRACK_URL,
        "updatedAt": dates[-1] if dates else None,
        "problems": problems,
    }


@app.get("/api/system-design")
def system_design():
    """Completed System Design decks in curriculum order. Each deck carries its
    full slide array; the diagram components live in the frontend by key."""
    if SessionLocal is None:
        return {"decks": []}
    with SessionLocal() as session:
        rows = session.execute(select(SDDeck).order_by(SDDeck.n)).scalars().all()
        decks = [
            {
                "n": r.n,
                "slug": r.slug,
                "title": r.title,
                "lastReviewed": r.last_reviewed,
                "slides": r.slides or [],
            }
            for r in rows
        ]
    return {"decks": decks}


@app.get("/api/daily-log")
def daily_log():
    """Curated daily-log entries, newest first. LeetCode items are enriched with
    their solution URL from the leetcode table (single source)."""
    if SessionLocal is None:
        return []
    with SessionLocal() as session:
        sol = {
            pid: url
            for pid, url in session.execute(
                select(LeetcodeProblem.id, LeetcodeProblem.solution_url)
            ).all()
        }
        rows = session.execute(select(DailyLog).order_by(DailyLog.date.desc())).scalars().all()
        return [
            {
                "date": r.date,
                "week": r.week,
                "done": r.done or [],
                "summary": r.summary,
                "note": r.note,
                "leetcode": [
                    {**item, "solutionUrl": sol.get(item.get("id"))} for item in (r.leetcode or [])
                ],
            }
            for r in rows
        ]
