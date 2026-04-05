import sys
from sqlmodel import Session, select
from models import Order, Deduction
from backend.payments import Payment, PaymentAllocation
from backend.database import engine
from payment_service import PaymentDistributionService

def check():
    session = Session(engine)
    orders = session.exec(select(Order).order_by(Order.id.asc())).all()
    
    total_stats = 0.0
    total_alloc = 0.0
    
    print(f"{'ID':<4} | {'Name':<25} | {'Stats Debt':<10} | {'Alloc Cap':<10} | Diff")
    print("-" * 75)
    
    for o in orders:
        # What stats sees:
        _, advance_amount, final_amount = PaymentDistributionService._calculate_financials(o, session)
        advance_remaining = max(0, advance_amount - o.advance_paid_amount)
        final_remaining = max(0, final_amount - o.final_paid_amount)
        
        stat_debt = 0.0
        if o.date_to_work:
            stat_debt += advance_remaining
        if o.date_installation:
             stat_debt += final_remaining
             
        # What allocator sees:
        alloc_cap = 0.0
        if o.date_to_work:
            alloc_adv = max(0, advance_amount - o.advance_paid_amount)
            if alloc_adv > 0.01:
                alloc_cap += alloc_adv
        if o.date_installation:
            alloc_fin = max(0, final_amount - o.final_paid_amount)
            if alloc_fin > 0.01:
                alloc_cap += alloc_fin
                
        if stat_debt > 0.01 or alloc_cap > 0.01:
            diff = stat_debt - alloc_cap
            print(f"{o.id:<4} | {o.name[:25]:<25} | {stat_debt:<10.2f} | {alloc_cap:<10.2f} | {diff}")
            total_stats += stat_debt
            total_alloc += alloc_cap
            
    print("-" * 75)
    print(f"SUMS | {'':<25} | {total_stats:<10.2f} | {total_alloc:<10.2f} | {total_stats - total_alloc}")

if __name__ == '__main__':
    check()
