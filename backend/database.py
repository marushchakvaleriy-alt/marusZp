from sqlmodel import SQLModel, create_engine, Session
from models import Order, Deduction  # Import to register models
from payments import Payment, PaymentAllocation  # Import payment models

import os

# Database Config
DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.startswith("postgres"):
    # Fix for some hosting providers using postgres:// instead of postgresql://
    database_url = DATABASE_URL.replace("postgres://", "postgresql://")
    connect_args = {} # Postgres doesn't need check_same_thread
else:
    # Local development with SQLite
    sqlite_file_name = "database.db"
    database_url = f"sqlite:///{sqlite_file_name}"
    connect_args = {"check_same_thread": False}

engine = create_engine(database_url, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
