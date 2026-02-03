import sys
import os
sys.path.append(os.getcwd())

from sqlmodel import Session, select, create_engine
from backend.models import Order, User
from backend.payments import Payment, PaymentAllocation
from backend.database import engine
from datetime import date

def test_deletion_logic():
    with Session(engine) as session:
        print("--- SETUP ---")
        # 1. Create Constructor
        user = User(username="test_user_del", password_hash="hash", full_name="Tester", role="constructor")
        session.add(user)
        session.commit()
        session.refresh(user)
        
        # 2. Create Order (Price 1000)
        # Bonus = 50 (5%), Advance = 25, Final = 25
        order = Order(
            name="Test Delete Order",
            price=1000,
            constructor_id=user.id,
            date_to_work=date.today(), # Ready for advance
            date_installation=date.today() # Ready for final
        )
        session.add(order)
        session.commit()
        session.refresh(order)
        print(f"Order Created: ID {order.id}, Paid: {order.advance_paid_amount}/{order.final_paid_amount}")

        # 3. Create Payment (50 UAH) to cover full salary
        payment = Payment(
            amount=50.0,
            date_received=date.today(),
            allocated_automatically=True,
            constructor_id=user.id
        )
        session.add(payment)
        session.commit()
        session.refresh(payment)
        print(f"Payment Created: ID {payment.id}, Amount: {payment.amount}")

        # 4. Run Distribution (Simulate API behavior)
        from backend.payment_service import PaymentDistributionService
        PaymentDistributionService.distribute_all_unallocated(session)
        
        session.refresh(order)
        print(f"After Payment: Order Paid: {order.advance_paid_amount}/{order.final_paid_amount}")
        print(f"Order Dates: Advance={order.date_advance_paid}, Final={order.date_final_paid}")

        if not order.date_final_paid:
            print("ERROR: Order should be paid!")
            return

        # 5. DELETE PAYMENT using the function from routes logic (simulated)
        print("--- DELETING PAYMENT ---")
        
        # Copied logic from routes.py delete_payment
        # We can't easily call route function directly because of Depends, so we mimic logic
        
        # A. Delete Payment
        session.delete(payment)
        session.commit()
        
        # B. Reset World
        from sqlalchemy import delete, update
        session.exec(delete(PaymentAllocation))
        
        statement = update(Order).values(
            advance_paid_amount=0,
            final_paid_amount=0,
            date_advance_paid=None,
            date_final_paid=None
        )
        session.exec(statement)
        session.commit()
        
        # C. Re-Distribute
        PaymentDistributionService.distribute_all_unallocated(session)
        
        # 6. VERIFY
        session.refresh(order)
        print(f"After Deletion: Order Paid: {order.advance_paid_amount}/{order.final_paid_amount}")
        print(f"Order Dates: Advance={order.date_advance_paid}, Final={order.date_final_paid}")
        
        if order.date_final_paid:
            print("FAILURE: Order is still paid! (Likely by other funds?)")
        else:
            print("SUCCESS: Order is unpaid.")

        # CLEANUP
        session.delete(order)
        session.delete(user)
        session.commit()

if __name__ == "__main__":
    test_deletion_logic()
