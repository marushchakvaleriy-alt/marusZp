import sys
import os

# Add current directory to path so imports work
sys.path.append(os.getcwd())

from database import get_session
from payment_service import PaymentDistributionService
from models import Order
from payments import Payment

from sqlmodel import delete

def fix():
    session = next(get_session())
    print("WARNING: Resetting all allocations to fix distribution...")
    
    # 1. Clear Allocations
    session.exec(delete(PaymentAllocation))
    
    # 2. Reset Orders
    orders = session.exec(select(Order)).all()
    for o in orders:
        o.advance_paid_amount = 0.0
        o.final_paid_amount = 0.0
        # Optional: Reset dates? 
        # Better to leave dates if they were manually set? 
        # The logic sets them if they are None.
        # If they are already set, logic won't overwrite them?
        # Actually logic says: `if ... and not order.date_advance_paid`.
        # So it preserves existing dates. Good.
        session.add(o)
        
    session.commit()
    print("Reset complete. Starting fresh distribution...")
    
    # Run distribution
    allocations = PaymentDistributionService.distribute_all_unallocated(session)
    
    print(f"Done! Created {len(allocations)} allocations.")
    for a in allocations:
        print(f"Allocated {a['amount']} to Order #{a['order_id']} ({a['stage']})")
    
    # Print summary of Order #2
    o2 = session.get(Order, 2)
    if o2:
        print(f"Order #2 Status: Paid {o2.advance_paid_amount} / {o2.advance_amount + o2.final_amount}") 


if __name__ == "__main__":
    fix()
