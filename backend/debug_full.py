
import sys
import os

# Add backend directory to sys.path
sys.path.append(os.getcwd())

from database import get_session_context
from models import User, Order, OrderRead, OrderCreate
from routes import create_order
from sqlmodel import select

def debug_system():
    print("🔍 DEBUGGING SYSTEM...")
    
    with get_session_context() as session:
        # 1. LIST USERS
        print("\n👥 USERS IN DB:")
        users = session.exec(select(User)).all()
        marushak_id = None
        for u in users:
            print(f"   ID: {u.id}, Name: {u.full_name}, User: {u.username}, Role: {u.role}")
            print(f"      Stages: {u.payment_stage1_percent}% / {u.payment_stage2_percent}%")
            
            if 'арущак' in (u.full_name or '') or 'arushak' in u.username:
                marushak_id = u.id

        if not marushak_id:
            print("❌ Marushchak not found!")
            return

        print(f"\n🎯 Using Marushchak ID: {marushak_id}")

        # 2. CREATE ORDER
        print("\n📦 CREATING TEST ORDER VIA CODE...")
        order_input = OrderCreate(
            name="DEBUG_ORDER_100",
            price=10000.0,  # 10k price -> 1k salary
            constructor_id=marushak_id,
            date_received="2026-02-04"
        )
        
        # Manually verify logic
        print("   Checking logic before save...")
        constructor = session.get(User, marushak_id)
        
        # Instantiate OrderRead directly to test logic
        # Mock order object
        mock_order = Order(
            id=9999,
            name="MOCK",
            price=10000.0,
            constructor_id=marushak_id
        )
        
        read_obj = OrderRead.from_order(mock_order, constructor)
        print(f"   Logic Result -> Bonus: {read_obj.bonus}")
        print(f"   Logic Result -> Advance: {read_obj.advance_amount}")
        print(f"   Logic Result -> Final: {read_obj.final_amount}")
        
        if read_obj.advance_amount == 1000.0:
             print("   ✅ LOGIC IS CORRECT (100% Advance)")
        else:
             print(f"   ❌ LOGIC FAILED! Expected 1000, got {read_obj.advance_amount}")

if __name__ == "__main__":
    debug_system()
