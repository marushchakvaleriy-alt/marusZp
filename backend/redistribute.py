import sys
from sqlmodel import Session, select
from sqlalchemy import text
from database import engine
from payment_service import PaymentDistributionService

def run_redistribution():
    with Session(engine) as session:
        print("Starting full payment redistribution...")
        try:
            # 1. Delete all current allocations
            session.exec(text("DELETE FROM paymentallocation"))
            print("Deleted all payment allocations.")
            
            # 2. Reset order paid amounts
            session.exec(text("UPDATE \"order\" SET advance_paid_amount = 0, final_paid_amount = 0, date_advance_paid = NULL, date_final_paid = NULL"))
            print("Reset all order paid amounts and dates.")
            
            session.commit()
            
            # 3. Redistribute
            allocations = PaymentDistributionService.distribute_all_unallocated(session)
            print(f"Redistributed money. Total new allocations: {len(allocations)}")
            
        except Exception as e:
            session.rollback()
            print(f"Error occurred: {e}")

if __name__ == "__main__":
    run_redistribution()
