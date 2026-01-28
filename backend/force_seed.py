from sqlmodel import Session
from database import engine, create_db_and_tables
from models import Order
from datetime import date

def force_seed():
    create_db_and_tables()
    with Session(engine) as session:
        print("Creating order...")
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
        print("Data inserted!")

if __name__ == "__main__":
    force_seed()
