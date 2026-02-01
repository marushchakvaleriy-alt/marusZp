from sqlmodel import Session, select, create_engine
from models import User
import os

db_path = "backend/database.db"
if not os.path.exists(db_path):
    db_path = "database.db" # try local if running from backend dir
    if not os.path.exists(db_path):
        print(f"ERROR: {db_path} not found!")
        exit(1)

engine = create_engine(f"sqlite:///{db_path}")

def list_users():
    print("Connecting to database...")
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        print(f"Found {len(users)} users:")
        for u in users:
            print(f"ID: {u.id} | Username: {u.username} | Role: {u.role} | Name: {u.full_name}")

if __name__ == "__main__":
    list_users()
