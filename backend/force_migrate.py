from sqlmodel import Session, create_engine, text
from settings import load_settings
import os

# Setup Database connection same as main app
# Assuming SQLite default
sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
engine = create_engine(sqlite_url)

def force_migrate():
    print("--- FORCE MIGRATION STARTED ---")
    with Session(engine) as session:
        # Check telegram_id
        try:
            print("Checking for telegram_id column...")
            session.exec(text("SELECT telegram_id FROM user LIMIT 1"))
            print("SUCCESS: 'telegram_id' column already exists.")
        except Exception:
            print("Column 'telegram_id' NOT FOUND. Attempting to add...")
            try:
                session.connection().execute(text("ALTER TABLE user ADD COLUMN telegram_id VARCHAR"))
                session.commit()
                print("SUCCESS: Added 'telegram_id' column.")
            except Exception as e:
                print(f"ERROR: Failed to add column: {e}")
                session.rollback()

if __name__ == "__main__":
    force_migrate()
