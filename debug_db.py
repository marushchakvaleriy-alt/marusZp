import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from backend.database import engine, get_session
    from sqlmodel import Session, select, text
    from backend.models import User, Order
    print("✅ Successfully imported database modules")
except ImportError as e:
    print(f"❌ ImportError: {e}")
    # Try alternate import if running from root
    try:
        from database import engine, get_session
        from sqlmodel import Session, select, text
        from models import User, Order
        print("✅ Successfully imported database modules (alternate path)")
    except ImportError as e2:
        print(f"❌ ImportError (alternate): {e2}")
        sys.exit(1)

def test_connection():
    print("\n--- Testing Database Connection ---")
    try:
        with Session(engine) as session:
            # Try a simple query
            result = session.exec(text("SELECT 1")).one()
            print(f"✅ Database connection successful! Result: {result}")
            
            # Count users
            user_count = session.exec(select(User)).all()
            print(f"✅ Users found: {len(user_count)}")
            
            # Count orders
            order_count = session.exec(select(Order)).all()
            print(f"✅ Orders found: {len(order_count)}")
            
    except Exception as e:
        print(f"❌ Database Connection Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_connection()
