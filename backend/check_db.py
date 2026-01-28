from sqlmodel import Session, select
from database import engine
from models import Order

def check():
    with Session(engine) as session:
        orders = session.exec(select(Order)).all()
        print(f"Total orders: {len(orders)}")
        for o in orders:
            print(f"Order: {o.name}, Price: {o.price}")

if __name__ == "__main__":
    check()
