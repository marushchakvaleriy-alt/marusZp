
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.database import get_session_context
from backend.models import Order
from backend.payment_service import PaymentDistributionService
from sqlmodel import select

def recalculate():
    with get_session_context() as session:
        # 1. Reset all order payment states to 0 (but keep history if we were replaying... actually simpler to just try to allocate remaining funds)
        # Wait, if we already marked it as paid, we need to unmark it?
        # Yes, because it was marked paid PREMATURELY.
        
        orders = session.exec(select(Order)).all()
        print(f"Found {len(orders)} orders. Checking for premature 'paid' status...")
        
        dates_reset = 0
        
        for order in orders:
            # Re-calculate correct amounts
            _, advance_amount, final_amount = PaymentDistributionService._calculate_financials(order, session)
            
            # Check Advance
            if order.date_advance_paid:
                if order.advance_paid_amount < advance_amount - 0.01:
                    print(f"❌ Order #{order.id} Advance marked paid but {order.advance_paid_amount} < {advance_amount}. RESETTING DATE.")
                    order.date_advance_paid = None
                    dates_reset += 1
            
            # Check Final
            if order.date_final_paid:
                if order.final_paid_amount < final_amount - 0.01:
                    print(f"❌ Order #{order.id} Final marked paid but {order.final_paid_amount} < {final_amount}. RESETTING DATE.")
                    order.date_final_paid = None
                    dates_reset += 1
                    
            session.add(order)
        
        session.commit()
        print(f"Reset {dates_reset} premature dates.")
        
        # 2. Trigger redistribution of ALL free funds
        print("Triggering redistribution of unallocated funds...")
        allocations = PaymentDistributionService.distribute_all_unallocated(session)
        print(f"Created {len(allocations)} new allocations.")
        
        # 3. Print final status for Marushchak's order
        order = session.get(Order, 1) # Assuming ID 1
        if order:
            _, adv, fin = PaymentDistributionService._calculate_financials(order, session)
            print(f"Order #{order.id}: Paid {order.advance_paid_amount}/{adv} (Advance), {order.final_paid_amount}/{fin} (Final)")

if __name__ == "__main__":
    recalculate()
