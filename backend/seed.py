from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import Order
from datetime import date

def seed():
    create_db_and_tables()
    with Session(engine) as session:
        # Check if data exists
        existing = session.exec(select(Order)).first()
        if existing:
            print("Database already contains data.")
            return

        # Create sample order from the design
        order = Order(
            name="ГАДЗ_Бучач_Кухня_2 пов",
            price=287000.0,
            date_to_work=date(2025, 3, 14),
            date_advance_paid=date(2025, 3, 16),
            date_installation=None,
            date_final_paid=None
        )
        
        session.add(order)
        session.commit()
        print("Sample order created successfully!")

if __name__ == "__main__":
    seed()
