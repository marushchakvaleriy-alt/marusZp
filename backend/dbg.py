import sys
from sqlmodel import Session, select
from models import Order, Deduction
from payments import Payment, PaymentAllocation
from database import engine

session = Session(engine)
payments = session.exec(select(Payment)).all()
total_paid = sum(p.amount for p in payments)

allocs = session.exec(select(PaymentAllocation)).all()
total_alloc = sum(a.amount for a in allocs)

print(f"--- TOTALS ---")
print(f"Total Paid: {total_paid}")
print(f"Total Allocated: {total_alloc}")
print(f"Unallocated: {total_paid - total_alloc}")

orders = session.exec(select(Order)).all()
for o in orders:
    if o.id in (40, 33):
        print(f"--- ORDER {o.id} ---")
        deductions = session.exec(select(Deduction).where(Deduction.order_id == o.id)).all()
        fines = sum(d.amount for d in deductions)
        print(f"Fines: {fines}")
        print(f"Adv paid: {o.advance_paid_amount}")
        print(f"Fin paid: {o.final_paid_amount}")
        o_allocs = session.exec(select(PaymentAllocation).where(PaymentAllocation.order_id == o.id)).all()
        print(f"Allocs: {sum(a.amount for a in o_allocs)}")
