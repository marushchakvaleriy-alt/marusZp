import os
from datetime import date
from sqlmodel import Session, select, create_engine
from models import Order, User

def create_march_orders():
    # Setup database connection
    db_path = "backend/database.db"
    if not os.path.exists(db_path):
        db_path = "database.db"
        if not os.path.exists(db_path):
            print("ERROR: Database database.db not found!")
            return

    engine = create_engine(f"sqlite:///{db_path}")

    with Session(engine) as session:
        # Find first constructor and manager
        constructor = session.exec(select(User).where(User.role == "constructor")).first()
        manager = session.exec(select(User).where(User.role == "manager")).first()

        constructor_id = constructor.id if constructor else None
        manager_id = manager.id if manager else None

        print(f"Assigning orders to Constructor ID: {constructor_id}, Manager ID: {manager_id}")

        orders_data = [
            {
                "name": "Тест Березень 1 - Шафа-купе",
                "price": 45000.0,
                "material_cost": 20000.0,
                "date_received": date(2026, 3, 2),
                "date_to_work": date(2026, 3, 3),
                "date_design_deadline": date(2026, 3, 10),
                "date_installation_plan": date(2026, 3, 20),
            },
            {
                "name": "Тест Березень 2 - Кухня кутова",
                "price": 120000.0,
                "material_cost": 55000.0,
                "date_received": date(2026, 3, 5),
                "date_to_work": date(2026, 3, 6),
                "date_design_deadline": date(2026, 3, 15),
                "date_installation_plan": date(2026, 3, 25),
            },
            {
                "name": "Тест Березень 3 - Тумба ТВ",
                "price": 15000.0,
                "material_cost": 6000.0,
                "date_received": date(2026, 3, 8),
                "date_to_work": date(2026, 3, 9),
                "date_design_deadline": date(2026, 3, 12),
                "date_installation_plan": date(2026, 3, 18),
            },
            {
                "name": "Тест Березень 4 - Передпокій",
                "price": 35000.0,
                "material_cost": 15000.0,
                "date_received": date(2026, 3, 10),
                "date_to_work": date(2026, 3, 11),
                "date_design_deadline": date(2026, 3, 18),
                "date_installation_plan": date(2026, 3, 28),
            },
            {
                "name": "Тест Березень 5 - Дитяче ліжко",
                "price": 25000.0,
                "material_cost": 10000.0,
                "date_received": date(2026, 3, 12),
                "date_to_work": date(2026, 3, 13),
                "date_design_deadline": date(2026, 3, 17),
                "date_installation_plan": date(2026, 3, 24),
            },
            {
                "name": "Тест Березень 6 - Гардеробна",
                "price": 80000.0,
                "material_cost": 35000.0,
                "date_received": date(2026, 3, 15),
                "date_to_work": date(2026, 3, 16),
                "date_design_deadline": date(2026, 3, 24),
                "date_installation_plan": date(2026, 4, 5),
            },
            {
                "name": "Тест Березень 7 - Стіл письмовий",
                "price": 12000.0,
                "material_cost": 4500.0,
                "date_received": date(2026, 3, 18),
                "date_to_work": date(2026, 3, 19),
                "date_design_deadline": date(2026, 3, 23),
                "date_installation_plan": date(2026, 3, 30),
            },
            {
                "name": "Тест Березень 8 - Офісні меблі",
                "price": 150000.0,
                "material_cost": 70000.0,
                "date_received": date(2026, 3, 20),
                "date_to_work": date(2026, 3, 22),
                "date_design_deadline": date(2026, 3, 31),
                "date_installation_plan": date(2026, 4, 10),
            },
            {
                "name": "Тест Березень 9 - Комод",
                "price": 18000.0,
                "material_cost": 7500.0,
                "date_received": date(2026, 3, 22),
                "date_to_work": date(2026, 3, 23),
                "date_design_deadline": date(2026, 3, 27),
                "date_installation_plan": date(2026, 4, 3),
            },
            {
                "name": "Тест Березень 10 - Полиці",
                "price": 8000.0,
                "material_cost": 3000.0,
                "date_received": date(2026, 3, 25),
                "date_to_work": date(2026, 3, 26),
                "date_design_deadline": date(2026, 3, 30),
                "date_installation_plan": date(2026, 4, 5),
            }
        ]

        created_count = 0
        for item in orders_data:
            # Check if order with this name already exists to prevent duplicate seeding
            existing = session.exec(select(Order).where(Order.name == item["name"])).first()
            if existing:
                print(f"Order '{item['name']}' already exists.")
                continue

            order = Order(
                name=item["name"],
                price=item["price"],
                material_cost=item["material_cost"],
                date_received=item["date_received"],
                date_to_work=item["date_to_work"],
                date_design_deadline=item["date_design_deadline"],
                date_installation_plan=item["date_installation_plan"],
                constructor_id=constructor_id,
                manager_id=manager_id,
                # Default installation/final paid are None (Active orders)
                date_installation=None,
                date_final_paid=None
            )
            session.add(order)
            created_count += 1

        session.commit()
        print(f"Successfully created {created_count} test orders starting in March 2026!")

if __name__ == "__main__":
    create_march_orders()
