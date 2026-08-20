"""Database engine + session for the lia-til API (Neon Postgres)."""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
# Neon/Heroku sometimes hand out the legacy "postgres://" scheme; SQLAlchemy wants "postgresql://".
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://") :]

# pool_pre_ping avoids stale connections after Neon scale-to-zero suspends the compute.
engine = create_engine(DATABASE_URL, pool_pre_ping=True) if DATABASE_URL else None
SessionLocal = sessionmaker(bind=engine, autoflush=False) if engine else None

Base = declarative_base()
