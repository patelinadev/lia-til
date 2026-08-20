"""lia-til API — FastAPI backend (Phase 2 · S1).

Public endpoints only. The applications table holds full private data, but this
service exposes ONLY aggregate counts (no company names, roles, salaries).
Private full views come later behind auth (S2).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import func, select

from db import Base, SessionLocal, engine
from models import Application, DailyLog


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


@app.get("/api/daily-log")
def daily_log():
    """Curated daily-log entries, newest first."""
    if SessionLocal is None:
        return []
    with SessionLocal() as session:
        rows = session.execute(select(DailyLog).order_by(DailyLog.date.desc())).scalars().all()
        return [
            {
                "date": r.date,
                "week": r.week,
                "done": r.done or [],
                "summary": r.summary,
                "note": r.note,
                "leetcode": r.leetcode or [],
            }
            for r in rows
        ]
