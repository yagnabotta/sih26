from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker

try:
    from .config import settings
except (ImportError, ValueError):
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    from backend.app.config import settings

DATABASE_URL = settings.DATABASE_URL

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )
    # Enable SQLite foreign key constraints
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def ensure_emergency_schema():
    """
    Safely creates all database tables and verifies schema consistency.
    Performs column additions via ALTER TABLE if working with pre-existing tables.
    """
    # 1. Create any missing tables (e.g. incident_locations, incidents, responders, etc.)
    Base.metadata.create_all(bind=engine)

    # 2. Check and add missing columns to pre-existing tables
    with engine.connect() as conn:
        try:
            # Users table enhancements
            user_info = conn.execute(text("PRAGMA table_info(users)"))
            user_cols = {row[1] for row in user_info.fetchall()}
            if user_cols:
                if "phone" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(50)"))
                if "status" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'ACTIVE'"))

            # Safety reports table enhancements
            report_info = conn.execute(text("PRAGMA table_info(safety_reports)"))
            report_cols = {row[1] for row in report_info.fetchall()}
            if report_cols:
                for col_name, col_type in [
                    ("original_description", "TEXT"),
                    ("normalized_description", "TEXT"),
                    ("incident_latitude", "FLOAT"),
                    ("incident_longitude", "FLOAT"),
                    ("incident_address", "VARCHAR(500)"),
                    ("incident_location_name", "VARCHAR(200)")
                ]:
                    if col_name not in report_cols:
                        conn.execute(text(f"ALTER TABLE safety_reports ADD COLUMN {col_name} {col_type}"))

            conn.commit()
        except Exception as e:
            print("[DB Schema Check] Migration notice:", e)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

if __name__ == "__main__":
    print(f"Connecting to database: {DATABASE_URL}")
    ensure_emergency_schema()
    with engine.connect() as conn:
        tables = [row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table';")).fetchall()]
        print("Schema verified. Active tables:")
        for tbl in tables:
            print(f"  - {tbl}")
    print("Database is ready and operational.")
