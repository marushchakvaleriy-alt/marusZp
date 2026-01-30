from database import get_session
from models import Deduction, Order, Payment
from payment_service import PaymentDistributionService
from sqlmodel import select, delete
from datetime import date

def fix_fines():
    session = next(get_session())
    print("Checking for unpaid deductions to convert...")
    
    # 1. Find unpaid deductions
    deductions = session.exec(select(Deduction).where(Deduction.is_paid == False)).all()
    
    total_fines = sum(d.amount for d in deductions)
    print(f"Found {len(deductions)} unpaid deductions totaling {total_fines} UAH.")
    
    if total_fines > 0:
        # 2. Create a Payment for this amount
        # We assume this is "Internal Transfer" or "Fine Conversion"
        payment = Payment(
            amount=total_fines,
            date_received=date.today(),
            notes="Автоматичне зарахування штрафів",
            allocated_automatically=True
        )
        session.add(payment)
        session.commit()
        session.refresh(payment)
        print(f"Created Payment #{payment.id} for {total_fines} UAH.")
        
        # 3. Mark deductions as paid (so they don't count towards 'unallocated' in the stats formula anymore)
        # Note: The stats formula adds UNPAID deductions. So marking them paid removes them from the formula.
        # This prevents double counting (Logic: Unallocated = (Received + NewPayment) - Allocated + (UnpaidDeductions -> 0))
        for d in deductions:
            d.is_paid = True
            session.add(d)
        
        session.commit()
        
        # 4. Trigger Distribution
        print("Distributing funds...")
        PaymentDistributionService.distribute_all_unallocated(session)
        print("Distribution complete.")
    else:
        print("No fines to convert.")

if __name__ == "__main__":
    fix_fines()
