from sqlmodel import select
from database import get_session
from models import User
from auth import verify_password, get_password_hash

def debug_auth():
    print("--- AUTH DEBUG ---")
    session = next(get_session())
    
    # 1. Check if user exists
    user = session.exec(select(User).where(User.username == "admin")).first()
    
    if not user:
        print("ERROR: User 'admin' NOT FOUND in database!")
        # Try to fix it
        print("Attempting to create 'admin' user now...")
        try:
            pwd = "admin"
            hashed = get_password_hash(pwd)
            new_user = User(username="admin", password_hash=hashed, full_name="Admin", role="admin")
            session.add(new_user)
            session.commit()
            print("CREATED 'admin' user successfully.")
            return
        except Exception as e:
            print(f"FAILED to create user: {e}")
            return

    print(f"User 'admin' found. ID: {user.id}")
    print(f"Stored Hash: {user.password_hash}")
    
    # 2. Check password
    try:
        is_valid = verify_password("admin", user.password_hash)
        print(f"Checking password 'admin': {'VALID' if is_valid else 'INVALID'}")
        
        if not is_valid:
            print("Password mismatch. Resetting password to 'admin'...")
            new_hash = get_password_hash("admin")
            user.password_hash = new_hash
            session.add(user)
            session.commit()
            print("Password RESET successfully.")
            
            # Verify again
            is_valid_now = verify_password("admin", user.password_hash)
            print(f"Re-check: {'VALID' if is_valid_now else 'STILL INVALID'}")

    except Exception as e:
        print(f"Error during verification: {e}")

if __name__ == "__main__":
    debug_auth()
