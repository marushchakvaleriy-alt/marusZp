import bcrypt
from sqlmodel import Session, select, create_engine
from models import User
import os

# Setup DB connection
# Direct path to ensure we hit the right file
db_path = "database.db"
if not os.path.exists(db_path):
    print(f"ERROR: {db_path} not found!")
    exit(1)

engine = create_engine(f"sqlite:///{db_path}")

def fix_admin():
    print("Connecting to database...")
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == "admin")).first()
        
        if not user:
            print("User 'admin' not found.")
            return
            
        print(f"Found user 'admin'. Current Hash: {user.password_hash[:10]}...")
        
        # Generate new hash
        password = "admin"
        pwd_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        new_hash = bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')
        
        user.password_hash = new_hash
        session.add(user)
        session.commit()
        
        print("\nSUCCESS! Password for 'admin' reset to 'admin'.")
        print(f"New Hash: {new_hash}")
        print("You can now login.")

if __name__ == "__main__":
    try:
        fix_admin()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
