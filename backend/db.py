"""Database engine + session for the lia-til API (Neon Postgres)."""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
# Name the driver explicitly. A bare "postgresql://" means "SQLAlchemy's default driver",
# and SQLAlchemy 2.1 changed that default from psycopg2 to psycopg (v3) — which is not in
# requirements.txt, so a fresh build crashed at import. Neon/Heroku also sometimes hand
# out the legacy "postgres://" scheme. A URL that already names a driver is left alone.
for _scheme in ("postgres://", "postgresql://"):
    if DATABASE_URL.startswith(_scheme):
        DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len(_scheme) :]
        break

# pool_pre_ping avoids stale connections after Neon scale-to-zero suspends the compute.
engine = create_engine(DATABASE_URL, pool_pre_ping=True) if DATABASE_URL else None
SessionLocal = sessionmaker(bind=engine, autoflush=False) if engine else None

Base = declarative_base()
