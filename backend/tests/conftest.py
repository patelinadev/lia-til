"""Test setup. Runs before any test module imports the app.

db.py calls load_dotenv(), and backend/.env holds the REAL Neon URL. load_dotenv
never overrides a variable that is already set, so set every value the app reads
here, first — the tests then only ever touch a throwaway SQLite file.
"""

import os
import sys
import tempfile

_DB_FILE = os.path.join(tempfile.mkdtemp(prefix="lia-til-test-"), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE}"
os.environ["BACKEND_SECRET"] = "test-admin-secret"
os.environ["DAILYLOG_SECRET"] = "test-daily-secret"
os.environ["MCP_TOKEN"] = "test-mcp-token-aaaaaaaaaaaaaaaaaaaaaaaa"
os.environ["SUBMIT_AGENT_SECRET"] = "test-submit-token-bbbbbbbbbbbbbbbbbbbbbb"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402

import db  # noqa: E402

assert db.engine is not None and db.engine.url.get_backend_name() == "sqlite", "tests must never reach Postgres"


@pytest.fixture(autouse=True)
def fresh_db():
    db.Base.metadata.drop_all(db.engine)
    db.Base.metadata.create_all(db.engine)
    yield
