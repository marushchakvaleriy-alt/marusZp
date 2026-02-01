from sqlmodel import Session, select, SQLModel
from database import engine, create_db_and_tables
from models import User, Order
from auth import get_password_hash
from sqlalchemy import text
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    # 1. Create new tables (User)
    logger.info("Creating new tables...")
    create_db_and_tables()
    
    # 2. Add constructor_id column to Order table
    # Check if column exists first to avoid error
    with Session(engine) as session:
        try:
            # Try to select the column to see if it exists
            session.exec(text("SELECT constructor_id FROM order LIMIT 1"))
            logger.info("Column 'constructor_id' already exists in 'order' table.")
        except Exception:
            logger.info("Column 'constructor_id' not found. Adding it...")
            try:
                # Add column. Note: 'order' is often a reserved word, so quoting might be needed depending on DB.
                # SQLModel uses 'order' as table name by default if class is Order.
                # SQLite/Postgres support ADD COLUMN.
                # For SQLite, adding FK constraint via ALTER TABLE is limited but usually works for simple cases or ignored.
                # We will add simple integer column first.
                session.connection().execute(text("ALTER TABLE \"order\" ADD COLUMN constructor_id INTEGER"))
                session.commit()
                logger.info("Added 'constructor_id' column.")
            except Exception as e:
                logger.error(f"Failed to add column 'constructor_id' with quotes: {e}")
                session.rollback() # Important! Clear failed transaction
                try:
                    session.connection().execute(text("ALTER TABLE order ADD COLUMN constructor_id INTEGER"))
                    session.commit()
                    logger.info("Added 'constructor_id' column (no quotes).")
                except Exception as e2:
                     logger.error(f"Failed to add 'constructor_id' (no quotes): {e2}")
                     session.rollback()

    # 3. Add date_design_deadline column to Order table
    with Session(engine) as session:
        try:
            # Check for column existence (Postgres is case sensitive with quotes)
            try:
                session.exec(text("SELECT date_design_deadline FROM \"order\" LIMIT 1"))
                logger.info("Column 'date_design_deadline' already exists.")
            except Exception:
                 session.rollback() # Reset if select failed (e.g. table not found in this transaction)
                 raise Exception("Column not found") # Trigger addition
        except Exception:
            logger.info("Column 'date_design_deadline' not found. Adding it...")
            try:
                session.connection().execute(text("ALTER TABLE \"order\" ADD COLUMN date_design_deadline DATE"))
                session.commit()
                logger.info("Added 'date_design_deadline' column.")
            except Exception as e:
                logger.error(f"Failed to add column 'date_design_deadline' with quotes: {e}")
                session.rollback()
                try:
                    session.connection().execute(text("ALTER TABLE order ADD COLUMN date_design_deadline DATE"))
                    session.commit()
                    logger.info("Added 'date_design_deadline' column (no quotes).")
                except Exception as e2:
                     logger.error(f"Retry failed for 'date_design_deadline': {e2}")
                     session.rollback()

    # 4. Seed Default Admin
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == "admin")).first()
        if not user:
            logger.info("Creating default admin user...")
            admin_user = User(
                username="admin",
                password_hash=get_password_hash("admin"),
                full_name="Administrator",
                role="admin"
            )
            session.add(admin_user)
            session.commit()
            logger.info("Default admin created: admin / admin")
        else:
            logger.info("Admin user already exists. Updating password to ensure compatibility...")
            user.password_hash = get_password_hash("admin")
            session.add(user)
            session.commit()
            logger.info("Admin password reset to: admin")

if __name__ == "__main__":
    migrate()
