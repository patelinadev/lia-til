"""ORM models. The applications table holds the FULL private ledger; the public
API only ever returns aggregate counts derived from it."""

from sqlalchemy import Column, Date, Integer, String, Text

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
