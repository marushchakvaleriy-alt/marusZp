from sqlmodel import SQLModel, create_engine, Session
from models import Order, Deduction  # Import to register models
from payments import Payment, PaymentAllocation  # Import payment models

import os

# Database Config
DATABASE_URL = os.environ.get("DATABASE_URL")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

if DATABASE_URL and DATABASE_URL.startswith("postgres"):
    # Fix for some hosting providers using postgres:// instead of postgresql://
    database_url = DATABASE_URL.replace("postgres://", "postgresql://")
    connect_args = {} # Postgres doesn't need check_same_thread
    engine = create_engine(database_url, connect_args=connect_args, pool_pre_ping=True, pool_recycle=300)
else:
    # Local development with SQLite
    sqlite_file_name = os.environ.get("SQLITE_FILE_NAME", "database.db")
    sqlite_path = sqlite_file_name if os.path.isabs(sqlite_file_name) else os.path.join(BASE_DIR, sqlite_file_name)
    sqlite_path = os.path.abspath(sqlite_path).replace("\\", "/")
    database_url = f"sqlite:///{sqlite_path}"
    connect_args = {"check_same_thread": False}
    engine = create_engine(database_url, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
