import os
from sqlmodel import Session, select, create_engine
from models import Order, User, Deduction, OrderRead
from routes import get_financial_stats
from financial_logic import calculate_constructor_financials

def debug():
    db_path = "backend/database.db"
    if not os.path.exists(db_path):
        db_path = "database.db"
    
    engine = create_engine(f"sqlite:///{db_path}")
    
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == "Марущак Валерій")).first()
        if not user:
            # Let's search by ID 6 or role
            user = session.get(User, 6)
            if not user:
                print("User not found!")
                return
                
        print(f"=== Debugging User: {user.username} (ID: {user.id}) ===")
        
        # Unpaid deductions
        deductions = session.exec(
            select(Deduction)
            .where(Deduction.is_paid == False)
        ).all()
        print(f"Total unpaid deductions in DB: {len(deductions)}")
        for d in deductions:
            print(f"Deduction ID: {d.id} | Order ID: {d.order_id} | Amount: {d.amount} | Role: {d.target_role}")

        # Orders
        orders = session.exec(select(Order).where(Order.constructor_id == user.id)).all()
        print(f"\nOrders count: {len(orders)}")
        
        total_current_debt = 0.0
        for o in orders:
            financials = calculate_constructor_financials(o, session=session, constructor=user)
            order_read = OrderRead.from_order(o, session)
            print(f"Order #{o.id} | Name: {o.name}")
            print(f"  price: {o.price} | bonus: {financials['bonus']}")
            print(f"  advance_amount: {financials['advance_amount']} | final_amount: {financials['final_amount']}")
            print(f"  advance_paid: {o.advance_paid_amount} | final_paid: {o.final_paid_amount}")
            print(f"  advance_remaining: {financials['advance_remaining']} | final_remaining: {financials['final_remaining']}")
            print(f"  order_read.current_debt: {order_read.current_debt}")
            print(f"  financials['current_debt']: {financials['current_debt']}")
            total_current_debt += order_read.current_debt
            
        print(f"\nSum of order_read.current_debt: {total_current_debt}")

if __name__ == "__main__":
    debug()
