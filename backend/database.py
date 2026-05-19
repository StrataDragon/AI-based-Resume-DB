from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

PRIMARY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/resume_insight")
FALLBACK_DATABASE_URL = os.getenv("DATABASE_FALLBACK_URL", "sqlite:///./resume_insight.db")


def _build_engine(db_url: str):
    parsed = make_url(db_url)
    is_sqlite = parsed.drivername.startswith("sqlite")
    return create_engine(
        db_url,
        connect_args={"check_same_thread": False} if is_sqlite else {},
        pool_pre_ping=True,
    )


def _select_engine():
    primary_engine = _build_engine(PRIMARY_DATABASE_URL)
    try:
        with primary_engine.connect():
            pass
        print(f"[database] Using primary DB: {PRIMARY_DATABASE_URL}")
        return primary_engine
    except SQLAlchemyError as e:
        if not FALLBACK_DATABASE_URL or FALLBACK_DATABASE_URL == PRIMARY_DATABASE_URL:
            raise

        print(f"[database] Primary DB unavailable: {e}")
        print(f"[database] Falling back to: {FALLBACK_DATABASE_URL}")
        fallback_engine = _build_engine(FALLBACK_DATABASE_URL)
        with fallback_engine.connect():
            pass
        return fallback_engine


engine = _select_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
