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

def ensure_database_schema():
    """Ensures incident location, supervisor, and descriptive columns exist in SQLite database."""
    with engine.connect() as conn:
        try:
            # Check safety_reports table
            result = conn.execute(text("PRAGMA table_info(safety_reports)"))
            existing_cols = {row[1] for row in result.fetchall()}
            if existing_cols:
                new_cols = [
                    ("original_description", "TEXT"),
                    ("normalized_description", "TEXT"),
                    ("incident_latitude", "FLOAT"),
                    ("incident_longitude", "FLOAT"),
                    ("incident_address", "VARCHAR(500)"),
                    ("incident_location_name", "VARCHAR(200)"),
                    ("assigned_admin_id", "INTEGER")
                ]
                for col_name, col_type in new_cols:
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE safety_reports ADD COLUMN {col_name} {col_type}"))
                conn.commit()

            # Check users table
            user_result = conn.execute(text("PRAGMA table_info(users)"))
            existing_user_cols = {row[1] for row in user_result.fetchall()}
            if existing_user_cols:
                new_user_cols = [
                    ("mode", "VARCHAR(50) DEFAULT 'Field Operations'"),
                    ("zone", "VARCHAR(100)"),
                    ("assigned_admin_id", "INTEGER"),
                    ("permissions", "VARCHAR(500)")
                ]
                for col_name, col_type in new_user_cols:
                    if col_name not in existing_user_cols:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                conn.commit()
        except Exception as e:
            print("Database schema update notice:", e)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

if __name__ == "__main__":
    print(f"Connecting to database: {DATABASE_URL}")
    Base.metadata.create_all(bind=engine)
    ensure_database_schema()
    with engine.connect() as conn:
        tables = [row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table';")).fetchall()]
        print("Schema verified. Active tables:")
        for tbl in tables:
            print(f"  - {tbl}")
    print("Database is ready and operational.")
