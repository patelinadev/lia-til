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


class LeetcodeProblem(Base):
    __tablename__ = "leetcode_problems"

    id = Column(Integer, primary_key=True)  # LeetCode problem number
    seq = Column(Integer)  # preserves the 0x3f plan order within an episode
    slug = Column(String(120))
    title = Column(Text)
    topics = Column(JSON)  # list[str]
    ep = Column(Integer)
    difficulty = Column(String(10))
    status = Column(String(30))
    date = Column(String(10))  # last completion, nullable
    solution_url = Column(Text)  # nullable


class SDDeck(Base):
    """One completed System Design deck. `slides` holds the full ordered slide
    array (eyebrow/title/intro/bullets/notes/quote + a diagram KEY); the diagram
    components themselves stay in the frontend (web/app/system-design/diagrams.tsx).
    The 30-deck curriculum route (PHASES) stays static in the frontend — only the
    decks that actually have content live here."""

    __tablename__ = "sd_decks"

    slug = Column(String(120), primary_key=True)
    n = Column(Integer)  # position in the 30-deck curriculum
    title = Column(Text)
    last_reviewed = Column(String(10))  # "YYYY-MM-DD"
    slides = Column(JSON)  # list[Slide]


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
