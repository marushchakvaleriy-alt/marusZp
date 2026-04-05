from datetime import date, datetime
from typing import List, Tuple, Optional
from sqlmodel import Session, select
from models import Order, User
from payments import Payment, PaymentAllocation
from financial_logic import calculate_constructor_financials

class PaymentDistributionService:
    """Сервіс для автоматичного розподілу платежів"""
    
    @staticmethod
    def distribute_payment(
        payment_amount: float,
        session: Session,
        manual_order_id: Optional[int] = None
    ) -> Tuple[List[dict], float]:
        """
        Розподіляє платіж по замовленнях
        
        Returns:
            Tuple[List[allocations], remaining_amount]
        """
        allocations = []
        remaining = payment_amount
        
        if manual_order_id:
            # Ручний розподіл на конкретне замовлення
            order = session.get(Order, manual_order_id)
            if order:
                remaining, order_allocations = PaymentDistributionService._allocate_to_order(
                    order, remaining, session
                )
                allocations.extend(order_allocations)
        else:
            # Автоматичний розподіл - по порядку створення замовлень (ID)
            orders = session.exec(
                select(Order)
                .order_by(Order.id.asc())  # Сортуємо по ID (старіші спочатку)
            ).all()
            
            for order in orders:
                if remaining <= 0:
                    break
                # Обробляємо обидва етапи для кожного замовлення
                remaining, order_allocations = PaymentDistributionService._allocate_to_order(
                    order, remaining, session
                )
                allocations.extend(order_allocations)
        
        return allocations, remaining
    
    @staticmethod
    def _calculate_financials(order: Order, session: Session) -> Tuple[float, float, float, float]:
        """
        Calculates (bonus, advance_amount, final_amount) using the same logic as OrderRead.
        """
        constructor_financials = calculate_constructor_financials(order, session=session)
        bonus = constructor_financials["bonus"]
        advance_amount = constructor_financials["advance_amount"]
        final_amount = constructor_financials["final_amount"]
        
        # 3. Manager Bonus
        manager = session.get(User, order.manager_id) if order.manager_id else None
        manager_bonus = 0.0
        if manager and hasattr(manager, 'salary_mode') and hasattr(manager, 'salary_percent'):
            if manager.salary_mode == 'fixed_amount':
                manager_bonus = manager.salary_percent
            elif manager.salary_mode == 'materials_percent':
                manager_bonus = (order.material_cost or 0) * (manager.salary_percent / 100)
            else:
                manager_bonus = order.price * (manager.salary_percent / 100)
        
        return bonus, advance_amount, final_amount, manager_bonus

    @staticmethod
    def _allocate_to_order(
        order: Order,
        available_amount: float,
        session: Session,
        stage_priority: Optional[str] = None
    ) -> Tuple[float, List[dict]]:
        """Розподіляє платіж на конкретне замовлення"""
        allocations = []
        remaining = available_amount
        
        # Calculate financials dynamically
        _, advance_amount, final_amount, _ = PaymentDistributionService._calculate_financials(order, session)
        
        # Аванс
        if (stage_priority is None or stage_priority == "advance"):
            # Only allocate usage if work has started/handed over (date_to_work is set)
            if order.date_to_work:
                advance_remaining = max(0, advance_amount - order.advance_paid_amount)
                if advance_remaining > 0.01 and remaining > 0:
                    allocation = min(remaining, advance_remaining)
                    order.advance_paid_amount += allocation
                    remaining -= allocation
                    
                    # Якщо оплачено повністю, поставити дату
                    if order.advance_paid_amount >= advance_amount - 0.01 and not order.date_advance_paid:
                        order.date_advance_paid = date.today()
                    
                    allocations.append({
                        "order_id": order.id,
                        "order_name": order.name,
                        "stage": "advance",
                        "amount": allocation
                    })
        
        # Фінальна оплата
        if (stage_priority is None or stage_priority == "final"):
            # Only allocate final payment if installation is done (date_installation is set)
            if order.date_installation:
                final_remaining = max(0, final_amount - order.final_paid_amount)
                if final_remaining > 0.01 and remaining > 0:
                    allocation = min(remaining, final_remaining)
                    order.final_paid_amount += allocation
                    remaining -= allocation
                    
                    # Якщо оплачено повністю, поставити дату
                    if order.final_paid_amount >= final_amount - 0.01 and not order.date_final_paid:
                        order.date_final_paid = date.today()
                    
                    allocations.append({
                        "order_id": order.id,
                        "order_name": order.name,
                        "stage": "final",
                        "amount": allocation
                    })
        
        session.add(order)
        
        return remaining, allocations

    @staticmethod
    def distribute_all_unallocated(
        session: Session
    ) -> List[dict]:
        """
        Розподіляє ВСІ вільні кошти з усіх платежів по замовленнях.
        Використовує FIFO: старі платежі закривають старі замовлення.
        """
        all_allocations = []
        
        # 1. Отримуємо всі платежі
        payments = session.exec(
            select(Payment).order_by(Payment.date_received.asc(), Payment.id.asc())
        ).all()
        
        # 2. Отримуємо всі замовлення, які потребують оплати (відсортовані: спочатку старі)
        # We need to fetch fresh state for every allocation loop, but for optimization
        # we can fetch once and update objects in memory if session is persistent.
        # But safest is to iterate payments and for each payment try to fill orders.
        
        orders = session.exec(
            select(Order).order_by(Order.id.asc())
        ).all()
        
        for payment in payments:
            # Рахуємо скільки залишилось у цього платежу
            existing_allocs = session.exec(
                select(PaymentAllocation).where(PaymentAllocation.payment_id == payment.id)
            ).all()
            used_amount = sum(a.amount for a in existing_allocs)
            remaining_payment = payment.amount - used_amount
            
            if remaining_payment <= 0.01:
                continue

            # Визначаємо цільові замовлення: одне (ручний) чи всі (авто)
            target_orders = orders
            
            # Пріоритет 1: Ручний вибір конкретного замовлення
            if payment.manual_order_id:
                manual_order = next((o for o in orders if o.id == payment.manual_order_id), None)
                if manual_order:
                    target_orders = [manual_order]
                else:
                    # Якщо замовлення не знайдено, не розподіляємо нікуди
                    target_orders = [] 
            
            # Пріоритет 2: Фільтрація по конструктору (якщо це не ручний вибір замовлення)
            elif payment.constructor_id:
                # Розподіляти ТІЛЬКИ на замовлення цього конструктора
                target_orders = [o for o in orders if o.constructor_id == payment.constructor_id] 
            
            # Пріоритет 3: Фільтрація по менеджеру
            elif payment.manager_id:
                # Розподіляти ТІЛЬКИ на замовлення цього менеджера
                target_orders = [o for o in orders if o.manager_id == payment.manager_id]

            # Якщо є залишок, пробуємо його розподілити
            for order in target_orders:
                if remaining_payment <= 0.01:
                    break
                    
                # Скільки треба цьому замовленню?
                amount_allocated, new_allocs = PaymentDistributionService._allocate_payment_chunk_to_order(
                    order, remaining_payment, session, is_manager_payment=bool(payment.manager_id)
                )
                
                if amount_allocated > 0:
                    remaining_payment -= amount_allocated
                    
                    # Створюємо PaymentAllocation для цього шматка
                    for alloc_data in new_allocs:
                        pa = PaymentAllocation(
                            payment_id=payment.id,
                            order_id=alloc_data["order_id"],
                            stage=alloc_data["stage"],
                            amount=alloc_data["amount"]
                        )
                        session.add(pa)
                        all_allocations.append(alloc_data)
        
        session.commit()
        return all_allocations

    @staticmethod
    def _allocate_payment_chunk_to_order(
        order: Order,
        amount: float,
        session: Session,
        is_manager_payment: bool = False
    ) -> Tuple[float, List[dict]]:
        """
        Спроба 'влити' суму amount в замовлення.
        Повертає (скільки_взяли, список_аллокацій).
        """
        taken = 0.0
        allocations = []
        remaining_to_give = amount
        
        # Calculate financials dynamically
        _, advance_amount, final_amount, manager_bonus = PaymentDistributionService._calculate_financials(order, session)
        
        if is_manager_payment:
            # Менеджерська виплата
            manager_needed = max(0, manager_bonus - (order.manager_paid_amount or 0))
            if manager_needed > 0.01 and remaining_to_give > 0:
                chunk = min(remaining_to_give, manager_needed)
                order.manager_paid_amount += chunk
                taken += chunk
                remaining_to_give -= chunk
                
                if order.manager_paid_amount >= manager_bonus - 0.01 and not order.date_manager_paid:
                    order.date_manager_paid = date.today()
                
                allocations.append({
                    "order_id": order.id,
                    "order_name": order.name,
                    "stage": "manager",
                    "amount": chunk
                })
            return taken, allocations

        # Конструкторська виплата (default)
        # Розподіляти тільки якщо етап "Конструктив" здано (date_to_work has value)
        if order.date_to_work:
            advance_needed = max(0, advance_amount - order.advance_paid_amount)
            if advance_needed > 0.01 and remaining_to_give > 0:
                chunk = min(remaining_to_give, advance_needed)
                order.advance_paid_amount += chunk
                taken += chunk
                remaining_to_give -= chunk
                
                if order.advance_paid_amount >= advance_amount - 0.01 and not order.date_advance_paid:
                    order.date_advance_paid = date.today()
                    
                allocations.append({
                    "order_id": order.id,
                    "order_name": order.name,
                    "stage": "advance",
                    "amount": chunk
                })

        # 2. Фінал
        # Розподіляти тільки якщо монтаж завершено (date_installation has value)
        if order.date_installation:
            final_needed = max(0, final_amount - order.final_paid_amount)
            if final_needed > 0.01 and remaining_to_give > 0:
                chunk = min(remaining_to_give, final_needed)
                order.final_paid_amount += chunk
                taken += chunk
                remaining_to_give -= chunk
                
                if order.final_paid_amount >= final_amount - 0.01 and not order.date_final_paid:
                    order.date_final_paid = date.today()
                    
                allocations.append({
                    "order_id": order.id,
                    "order_name": order.name,
                    "stage": "final",
                    "amount": chunk
                })
            
        if taken > 0:
            session.add(order)
            
        return taken, allocations

