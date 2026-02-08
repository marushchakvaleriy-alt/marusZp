
import sys
import os

# Add backend directory to sys.path
sys.path.append(os.getcwd())

from database import get_session_context, engine
from models import User, Order
from sqlmodel import select

def simulate_creation(constructor_name_part):
    print(f"\n🧪 SIMULATING ORDER CREATION FOR: '{constructor_name_part}'")
    
    with get_session_context() as session:
        # 1. Find Constructor
        # We use a LIKE query to be sure we get the right one
        constructor = session.exec(select(User).where(User.full_name.contains(constructor_name_part))).first()
        
        if not constructor:
            print("❌ Constructor not found!")
            return

        print(f"   👤 Found: {constructor.full_name} (ID: {constructor.id})")
        print(f"      Settings: {constructor.payment_stage1_percent}% / {constructor.payment_stage2_percent}%")

        # 2. Simulate Logic in routes.py
        print("   ⚙️ executing logic...")
        
        # Mock Order Object (like Order.from_orm)
        db_order = Order(
            name=f"SIMULATED_{constructor.id}",
            price=10000.0,
            constructor_id=constructor.id
            # custom_stage1_percent is default None
        )
        
        # Logic from routes.py lines 237-247
        if constructor:
             if db_order.custom_stage1_percent is None:
                 print(f"      -> Copying stage1: {constructor.payment_stage1_percent}")
                 db_order.custom_stage1_percent = constructor.payment_stage1_percent
             
             if db_order.custom_stage2_percent is None:
                 print(f"      -> Copying stage2: {constructor.payment_stage2_percent}")
                 db_order.custom_stage2_percent = constructor.payment_stage2_percent
        
        # 3. Verify Result
        print(f"   ✅ RESULT ORDER: Stage1={db_order.custom_stage1_percent}, Stage2={db_order.custom_stage2_percent}")

        if db_order.custom_stage1_percent == 100.0:
            print("   🎉 SUCCESS: 100% applied!")
        elif db_order.custom_stage1_percent == 50.0:
            print("   ⚠️ WARNING: 50% applied (Is this new constructor? Then correct. If Marushchak, FAIL).")
        else:
            print(f"   ❓ UNEXPECTED: {db_order.custom_stage1_percent}")

if __name__ == "__main__":
    print(f"DB Path: {engine.url}")
    simulate_creation("арущак") # Marushchak
    simulate_creation("іфіафіваіфвівф") # The new constructor user created
