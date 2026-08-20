"""ORM models. The applications table holds the FULL private ledger; the public
API only ever returns aggregate counts derived from it."""

from sqlalchemy import JSON, Column, Date, Integer, String, Text

from db import Base


class Application(Base):
    __tablename__ = "applications"

    app_num = Column(Integer, primary_key=True)  # gapless running counter from the ledger
    company = Column(String(200))
    role = Column(Text)
    resume = Column(String(50))
    applied_date = Column(Date)
    status = Column(String(50))
    notes = Column(Text)


class DailyLog(Base):
    """One curated public entry per day (checked items + one-line summary/note).
    Private sections (Success Diary / PhD / etc.) are NOT stored here yet — they
    arrive with the login/private views in S3."""

    __tablename__ = "daily_logs"

    date = Column(String(10), primary_key=True)  # "YYYY-MM-DD"
    week = Column(String(8))  # ISO week label, e.g. "W34"
    done = Column(JSON)  # list[str]
    summary = Column(Text)
    note = Column(Text)
    leetcode = Column(JSON)  # list[{id, slug, title}]
