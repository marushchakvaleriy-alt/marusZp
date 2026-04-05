import sys
from sqlmodel import Session, select
from models import Order, Deduction, OrderRead
from payments import Payment, PaymentAllocation
from database import engine
from payment_service import PaymentDistributionService

def main():
    session = Session(engine)
    orders = session.exec(select(Order)).all()
    
    total_debt = 0.0
    print(f"| {'ID':<4} | {'Name':<30} | {'Advance Remaining':<18} | {'Final Remaining':<16} | {'Current Debt':<12} |")
    print("-" * 95)
    
    for o in orders:
        read_obj = OrderRead.from_order(o, session)
        if read_obj.current_debt > 0.01:
            print(f"| #{o.id:<3} | {o.name[:30]:<30} | {read_obj.advance_remaining:<18.2f} | {read_obj.final_remaining:<16.2f} | {read_obj.current_debt:<12.2f} |")
            total_debt += read_obj.current_debt
            
    print("-" * 95)
    print(f"TOTAL DEBT (Sum of above): {total_debt:.2f}")

if __name__ == "__main__":
    main()
