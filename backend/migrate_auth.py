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

                     logger.error(f"Retry failed for 'date_design_deadline': {e2}")
                     session.rollback()

    # 4. Add User Columns (card_number, email)
    with Session(engine) as session:
        try:
            # Check for card_number
            try:
                session.exec(text("SELECT card_number FROM user LIMIT 1"))
                logger.info("Column 'card_number' already exists.")
            except Exception:
                session.rollback()
                logger.info("Column 'card_number' not found. Adding it...")
                try:
                    session.connection().execute(text("ALTER TABLE user ADD COLUMN card_number VARCHAR"))
                    session.commit()
                    logger.info("Added 'card_number' column.")
                except Exception as e:
                     logger.error(f"Failed to add 'card_number': {e}")
                     session.rollback()
                     
            # Check for email
            try:
                session.exec(text("SELECT email FROM user LIMIT 1"))
                logger.info("Column 'email' already exists.")
            except Exception:
                session.rollback()
                logger.info("Column 'email' not found. Adding it...")
                try:
                    session.connection().execute(text("ALTER TABLE user ADD COLUMN email VARCHAR"))
                    session.commit()
                    logger.info("Added 'email' column.")
                except Exception as e:
                     logger.error(f"Failed to add 'email': {e}")
                     session.rollback()
                     
                     logger.error(f"Failed to add 'email': {e}")
                     session.rollback()

            # Check for phone_number
            try:
                session.exec(text("SELECT phone_number FROM user LIMIT 1"))
                logger.info("Column 'phone_number' already exists.")
            except Exception:
                session.rollback()
                logger.info("Column 'phone_number' not found. Adding it...")
                try:
                    session.connection().execute(text("ALTER TABLE user ADD COLUMN phone_number VARCHAR"))
                    session.commit()
                    logger.info("Added 'phone_number' column.")
                except Exception as e:
                     logger.error(f"Failed to add 'phone_number': {e}")
                     session.rollback()

            # Check for telegram_id
            try:
                session.exec(text("SELECT telegram_id FROM user LIMIT 1"))
                logger.info("Column 'telegram_id' already exists.")
            except Exception:
                session.rollback()
                logger.info("Column 'telegram_id' not found. Adding it...")
                try:
                    session.connection().execute(text("ALTER TABLE user ADD COLUMN telegram_id VARCHAR"))
                    session.commit()
                    logger.info("Added 'telegram_id' column.")
                except Exception as e:
                     logger.error(f"Failed to add 'telegram_id': {e}")
                     session.rollback()
            
            # Check for salary_mode
            try:
                session.exec(text("SELECT salary_mode FROM user LIMIT 1"))
                logger.info("Column 'salary_mode' already exists.")
            except Exception:
                session.rollback()
                logger.info("Column 'salary_mode' not found. Adding it...")
                try:
                    session.connection().execute(text("ALTER TABLE user ADD COLUMN salary_mode VARCHAR DEFAULT 'sales_percent'"))
                    session.commit()
                    logger.info("Added 'salary_mode' column.")
                except Exception as e:
                    logger.error(f"Failed to add 'salary_mode': {e}")
                    session.rollback()
            
            # Check for salary_percent
            try:
                session.exec(text("SELECT salary_percent FROM user LIMIT 1"))
                logger.info("Column 'salary_percent' already exists.")
            except Exception:
                session.rollback()
                logger.info("Column 'salary_percent' not found. Adding it...")
                try:
                    session.connection().execute(text("ALTER TABLE user ADD COLUMN salary_percent FLOAT DEFAULT 5.0"))
                    session.commit()
                    logger.info("Added 'salary_percent' column.")
                except Exception as e:
                    logger.error(f"Failed to add 'salary_percent': {e}")
                    session.rollback()
            
            # Check for payment_stage1_percent
            try:
                session.exec(text("SELECT payment_stage1_percent FROM user LIMIT 1"))
                logger.info("Column 'payment_stage1_percent' already exists.")
            except Exception:
                session.rollback()
                logger.info("Column 'payment_stage1_percent' not found. Adding it...")
                try:
                    session.connection().execute(text("ALTER TABLE user ADD COLUMN payment_stage1_percent FLOAT DEFAULT 50.0"))
                    session.commit()
                    logger.info("Added 'payment_stage1_percent' column.")
                except Exception as e:
                    logger.error(f"Failed to add 'payment_stage1_percent': {e}")
                    session.rollback()
            
            # Check for payment_stage2_percent
            try:
                session.exec(text("SELECT payment_stage2_percent FROM user LIMIT 1"))
                logger.info("Column 'payment_stage2_percent' already exists.")
            except Exception:
                session.rollback()
                logger.info("Column 'payment_stage2_percent' not found. Adding it...")
                try:
                    session.connection().execute(text("ALTER TABLE user ADD COLUMN payment_stage2_percent FLOAT DEFAULT 50.0"))
                    session.commit()
                    logger.info("Added 'payment_stage2_percent' column.")
                except Exception as e:
                    logger.error(f"Failed to add 'payment_stage2_percent': {e}")
                    session.rollback()
                     
        except Exception as outer_e:
            logger.error(f"Error checking user columns: {outer_e}")
            session.rollback()
    
    # 4b. Add Order Columns (material_cost)
    with Session(engine) as session:
        try:
            # Check for material_cost
            try:
                session.exec(text("SELECT material_cost FROM \"order\" LIMIT 1"))
                logger.info("Column 'material_cost' already exists.")
            except Exception:
                session.rollback()
                logger.info("Column 'material_cost' not found. Adding it...")
                try:
                    session.connection().execute(text("ALTER TABLE \"order\" ADD COLUMN material_cost FLOAT DEFAULT 0.0"))
                    session.commit()
                    logger.info("Added 'material_cost' column.")
                except Exception as e:
                    logger.error(f"Failed to add 'material_cost': {e}")
                    session.rollback()
            
            # Check for fixed_bonus
            try:
                session.exec(text("SELECT fixed_bonus FROM \"order\" LIMIT 1"))
                logger.info("Column 'fixed_bonus' already exists.")
            except Exception:
                session.rollback()
                logger.info("Column 'fixed_bonus' not found. Adding it...")
                try:
                    session.connection().execute(text("ALTER TABLE \"order\" ADD COLUMN fixed_bonus FLOAT"))
                    session.commit()
                    logger.info("Added 'fixed_bonus' column.")
                except Exception as e:
                    logger.error(f"Failed to add 'fixed_bonus': {e}")
                    session.rollback()
            
            # Check for custom_stage1_percent
            try:
                session.exec(text("SELECT custom_stage1_percent FROM \"order\" LIMIT 1"))
                logger.info("Column 'custom_stage1_percent' already exists.")
            except Exception:
                session.rollback()
                logger.info("Column 'custom_stage1_percent' not found. Adding it...")
                try:
                    session.connection().execute(text("ALTER TABLE \"order\" ADD COLUMN custom_stage1_percent FLOAT"))
                    session.commit()
                    logger.info("Added 'custom_stage1_percent' column.")
                except Exception as e:
                    logger.error(f"Failed to add 'custom_stage1_percent': {e}")
                    session.rollback()
            
            # Check for custom_stage2_percent
            try:
                session.exec(text("SELECT custom_stage2_percent FROM \"order\" LIMIT 1"))
                logger.info("Column 'custom_stage2_percent' already exists.")
            except Exception:
                session.rollback()
                logger.info("Column 'custom_stage2_percent' not found. Adding it...")
                try:
                    session.connection().execute(text("ALTER TABLE \"order\" ADD COLUMN custom_stage2_percent FLOAT"))
                    session.commit()
                    logger.info("Added 'custom_stage2_percent' column.")
                except Exception as e:
                    logger.error(f"Failed to add 'custom_stage2_percent': {e}")
                    session.rollback()
                except Exception as e:
                    logger.error(f"Failed to add 'custom_stage2_percent': {e}")
                    session.rollback()
            
            # Check for date_installation_plan (v1.6)
            try:
                session.exec(text("SELECT date_installation_plan FROM \"order\" LIMIT 1"))
                logger.info("Column 'date_installation_plan' already exists.")
            except Exception:
                session.rollback()
                logger.info("Column 'date_installation_plan' not found. Adding it...")
                try:
                    session.connection().execute(text("ALTER TABLE \"order\" ADD COLUMN date_installation_plan DATE"))
                    session.commit()
                    logger.info("Added 'date_installation_plan' column.")
                except Exception as e:
                    logger.error(f"Failed to add 'date_installation_plan': {e}")
                    session.rollback()
                    try:
                        session.connection().execute(text("ALTER TABLE order ADD COLUMN date_installation_plan DATE"))
                        session.commit()
                        logger.info("Added 'date_installation_plan' column (unquoted).")
                    except Exception as e2:
                        logger.error(f"Failed to add 'date_installation_plan' (unquoted): {e2}")
                        session.rollback()

        except Exception as outer_e:
            logger.error(f"Error checking order columns: {outer_e}")
            session.rollback()

    # 5. Seed Default Admin
    with Session(engine) as session:
        try:
            # This might fail if columns are still missing and mapping is strict
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
        except Exception as e:
            logger.error(f"Failed to seed admin user (possibly schema mismatch): {e}")
            session.rollback()

if __name__ == "__main__":
    migrate()
