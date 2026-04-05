from sqlmodel import Session, create_engine, select, text
from backend.payments import Payment, PaymentAllocation
from backend.database import engine

def check_unallocated():
    with Session(engine) as session:
        # Get all payments
        payments = session.exec(select(Payment)).all()
        total_received = sum(p.amount for p in payments)
        
        # Get all allocations
        allocations = session.exec(select(PaymentAllocation)).all()
        total_allocated = sum(a.amount for a in allocations)
        
        print(f"Total Received: {total_received}")
        print(f"Total Allocated: {total_allocated}")
        print(f"Unallocated (Total): {total_received - total_allocated}")
        
        print("\nPayments with no allocations or no owners:")
        for p in payments:
            p_allocs = session.exec(select(PaymentAllocation).where(PaymentAllocation.payment_id == p.id)).all()
            allocated_amount = sum(a.amount for a in p_allocs)
            
            if allocated_amount < p.amount:
                print(f"ID: {p.id}, Amount: {p.amount}, Date: {p.date_received}, Allocated: {allocated_amount}, Left: {p.amount - allocated_amount}, Constructor: {p.constructor_id}, Manager: {p.manager_id}")

if __name__ == "__main__":
    check_unallocated()
