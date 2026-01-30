import sys
sys.path.append('backend')

from database import SessionLocal
from models import Order, Deduction
from payments import Payment, PaymentAllocation
from sqlmodel import select

session = SessionLocal()

print("=== ЗАМОВЛЕННЯ ===")
orders = session.exec(select(Order)).all()
for o in orders:
    print(f"#{o.id} {o.name}: Price={o.price}, Adv_paid={o.advance_paid_amount}, Fin_paid={o.final_paid_amount}")
    print(f"  date_to_work={o.date_to_work}, date_installation={o.date_installation}")
    print(f"  current_debt={o.current_debt}, is_critical={o.is_critical_debt}")

print("\n=== ПЛАТЕЖІ ===")
payments = session.exec(select(Payment)).all()
for p in payments:
    print(f"#{p.id}: {p.amount} грн, notes='{p.notes}'")
    
print("\n=== РОЗПОДІЛ ПЛАТЕЖІВ ===")
allocs = session.exec(select(PaymentAllocation)).all()
for a in allocs:
    order = session.get(Order, a.order_id)
    print(f"Payment #{a.payment_id} -> Order #{a.order_id} ({order.name if order else '?'}): {a.amount} грн, stage={a.stage}")

print("\n=== ШТРАФИ ===")
deductions = session.exec(select(Deduction)).all()
for d in deductions:
    order = session.get(Order, d.order_id)
    print(f"#{d.id} Order #{d.order_id} ({order.name if order else '?'}): {d.amount} грн, paid={d.is_paid}")

session.close()
