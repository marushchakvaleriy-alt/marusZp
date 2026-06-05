import os
from datetime import date, timedelta
from sqlmodel import Session, select, create_engine
from models import Order, User, Deduction, ActivityLog, OrderFile
from payments import Payment, PaymentAllocation

def reset_database():
    db_path = "backend/database.db"
    if not os.path.exists(db_path):
        db_path = "database.db"
        if not os.path.exists(db_path):
            print("ERROR: Database database.db not found!")
            return

    engine = create_engine(f"sqlite:///{db_path}")

    with Session(engine) as session:
        print("Clearing transactional tables...")
        # Clear allocations and order details first (due to FK constraints)
        session.exec(PaymentAllocation.__table__.delete())
        session.exec(Payment.__table__.delete())
        session.exec(Deduction.__table__.delete())
        session.exec(OrderFile.__table__.delete())
        session.exec(ActivityLog.__table__.delete())
        session.exec(Order.__table__.delete())
        session.commit()
        print("Database cleared.")

        # Find first constructor and manager to assign the new orders
        constructor = session.exec(select(User).where(User.role == "constructor")).first()
        manager = session.exec(select(User).where(User.role == "manager")).first()

        constructor_id = constructor.id if constructor else None
        manager_id = manager.id if manager else None

        print(f"Assigning new orders to Constructor ID: {constructor_id}, Manager ID: {manager_id}")

        today = date.today()

        new_orders = [
            {
                "name": "Нове Замовлення 1 - Кухня Класик",
                "price": 120000.0,
                "material_cost": 50000.0,
                "date_received": today - timedelta(days=2),
                "date_design_deadline": today + timedelta(days=5),
                "date_installation_plan": today + timedelta(days=25),
            },
            {
                "name": "Нове Замовлення 2 - Шафа-купе Дзеркало",
                "price": 40000.0,
                "material_cost": 15000.0,
                "date_received": today - timedelta(days=1),
                "date_design_deadline": today + timedelta(days=6),
                "date_installation_plan": today + timedelta(days=20),
            },
            {
                "name": "Нове Замовлення 3 - Тумба під ТВ",
                "price": 15000.0,
                "material_cost": 5000.0,
                "date_received": today,
                "date_design_deadline": today + timedelta(days=4),
                "date_installation_plan": today + timedelta(days=15),
            },
            {
                "name": "Нове Замовлення 4 - Передпокій Loft",
                "price": 35000.0,
                "material_cost": 12000.0,
                "date_received": today,
                "date_design_deadline": today + timedelta(days=7),
                "date_installation_plan": today + timedelta(days=30),
            },
            {
                "name": "Нове Замовлення 5 - Стіл письмовий",
                "price": 18000.0,
                "material_cost": 6000.0,
                "date_received": today,
                "date_design_deadline": today + timedelta(days=5),
                "date_installation_plan": today + timedelta(days=12),
            }
        ]

        for item in new_orders:
            order = Order(
                name=item["name"],
                price=item["price"],
                material_cost=item["material_cost"],
                date_received=item["date_received"],
                date_to_work=None,  # NOT launched
                date_design_deadline=item["date_design_deadline"],
                date_installation_plan=item["date_installation_plan"],
                constructor_id=constructor_id,
                manager_id=manager_id,
                date_installation=None,
                date_final_paid=None,
                advance_paid_amount=0.0,
                final_paid_amount=0.0,
                manager_paid_amount=0.0
            )
            session.add(order)

        session.commit()
        print("Successfully created 5 unlaunched new orders!")

if __name__ == "__main__":
    reset_database()
