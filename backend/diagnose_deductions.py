import sys
import os

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select
from database import engine
from models import Order, User, Deduction
from payments import Payment, PaymentAllocation

def run_diagnose():
    with Session(engine) as session:
        print("=== DATABASE SUMMARY ===")
        
        # Count tables
        users = session.exec(select(User)).all()
        orders = session.exec(select(Order)).all()
        payments = session.exec(select(Payment)).all()
        allocations = session.exec(select(PaymentAllocation)).all()
        deductions = session.exec(select(Deduction)).all()
        
        print(f"Total Users: {len(users)}")
        print(f"Total Orders: {len(orders)}")
        print(f"Total Payments: {len(payments)}")
        print(f"Total Allocations: {len(allocations)}")
        print(f"Total Deductions: {len(deductions)}")
        
        print("\n=== USERS ===")
        for u in users:
            print(f"  ID: {u.id}, Username: '{u.username}', Role: '{u.role}', Full Name: '{u.full_name}'")
            
        print("\n=== ORDERS ===")
        for o in orders:
            print(f"  ID: {o.id}, Name: '{o.name}', Price: {o.price}, Constructor ID: {o.constructor_id}, Manager ID: {o.manager_id}")
            print(f"    Paid: Advance: {o.advance_paid_amount}, Final: {o.final_paid_amount}")
            print(f"    Dates: Work: {o.date_to_work}, Install: {o.date_installation}, AdvPaid: {o.date_advance_paid}, FinPaid: {o.date_final_paid}")
            
        print("\n=== PAYMENTS ===")
        for p in payments:
            print(f"  ID: {p.id}, Amount: {p.amount}, Date: {p.date_received}, Auto: {p.allocated_automatically}, Constructor: {p.constructor_id}, Manager: {p.manager_id}")

        print("\n=== ALLOCATIONS ===")
        for a in allocations:
            print(f"  ID: {a.id}, Payment ID: {a.payment_id}, Order ID: {a.order_id}, Stage: '{a.stage}', Amount: {a.amount}")

        print("\n=== DEDUCTIONS ===")
        for d in deductions:
            print(f"  ID: {d.id}, Order ID: {d.order_id}, Amount: {d.amount}, Description: '{d.description}', Is Paid: {d.is_paid}, Target Role: '{getattr(d, 'target_role', None)}'")

        print("\n=== UNALLOCATED PER CONSTRUCTOR ===")
        for c in [u for u in users if u.role == 'constructor']:
            c_payments = [p for p in payments if p.constructor_id == c.id]
            c_total_received = sum(p.amount for p in c_payments)
            c_payment_ids = [p.id for p in c_payments]
            
            c_allocations = [a for a in allocations if a.payment_id in c_payment_ids]
            c_total_allocated = sum(a.amount for a in c_allocations)
            
            print(f"  Constructor: '{c.full_name or c.username}' (ID: {c.id})")
            print(f"    Received: {c_total_received}, Allocated: {c_total_allocated}, Unallocated: {c_total_received - c_total_allocated}")

if __name__ == "__main__":
    from financial_logic import calculate_constructor_financials
    from models import OrderRead
    with Session(engine) as session:
        o2 = session.get(Order, 2)
        print("\n=== ORDER 2 FINANCIALS ===")
        print(f"  asdasd Price: {o2.price}")
        fin = calculate_constructor_financials(o2, session)
        print(f"  calculate_constructor_financials output: {fin}")
        oread = OrderRead.from_order(o2, session)
        print(f"  OrderRead.from_order fields:")
        print(f"    bonus: {oread.bonus}")
        print(f"    advance_amount: {oread.advance_amount}")
        print(f"    advance_remaining: {oread.advance_remaining}")
        print(f"    final_amount: {oread.final_amount}")
        print(f"    final_remaining: {oread.final_remaining}")
        print(f"    remainder_amount: {oread.remainder_amount}")
        print(f"    current_debt: {oread.current_debt}")
        print(f"    is_critical_debt: {oread.is_critical_debt}")
