
import sys
import os

# Add backend to path
# Assuming the script is run from project root
sys.path.append(os.path.join(os.getcwd(), 'backend'))
# If run from backend dir, add parent
sys.path.append(os.getcwd())


from backend.database import get_session_context
from backend.models import Order
from backend.payment_service import PaymentDistributionService
from sqlmodel import select

def recalculate():
    print("Starting recalculation...")
    with get_session_context() as session:
        orders = session.exec(select(Order)).all()
        print(f"Found {len(orders)} orders. Checking for premature 'paid' status...")
        
        dates_reset = 0
        
        for order in orders:
            # Re-calculate correct amounts
            try:
                # This might fail if imports are still wonky in the script context, but we fixed payment_service.py now
                _, advance_amount, final_amount = PaymentDistributionService._calculate_financials(order, session)
                
                # Check Advance
                if order.date_advance_paid:
                    # Tolerance 1.0 to be safe against float weirdness, but logic says 0.01
                    if order.advance_paid_amount < advance_amount - 1.0:
                        print(f"❌ Order #{order.id} Advance marked paid but {order.advance_paid_amount} < {advance_amount}. RESETTING DATE.")
                        order.date_advance_paid = None
                        dates_reset += 1
                
                # Check Final
                if order.date_final_paid:
                    if order.final_paid_amount < final_amount - 1.0:
                        print(f"❌ Order #{order.id} Final marked paid but {order.final_paid_amount} < {final_amount}. RESETTING DATE.")
                        order.date_final_paid = None
                        dates_reset += 1
                        
                session.add(order)
            except Exception as e:
                print(f"Error processing order {order.id}: {e}")
        
        session.commit()
        print(f"Reset {dates_reset} premature dates.")
        
        # 2. Trigger redistribution of ALL free funds
        print("Triggering redistribution of unallocated funds...")
        try:
            allocations = PaymentDistributionService.distribute_all_unallocated(session)
            print(f"Created {len(allocations)} new allocations.")
        except Exception as e:
            print(f"Error distributing funds: {e}")
        
        # 3. Print final status for any active order
        # Just grab the last transformed one or specific ID if known
        print("Done.")

if __name__ == "__main__":
    recalculate()
