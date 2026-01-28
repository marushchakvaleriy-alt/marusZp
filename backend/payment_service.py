from datetime import date, datetime
from typing import List, Tuple
from sqlmodel import Session, select
from models import Order
from payments import Payment, PaymentAllocation

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
    def _allocate_to_order(
        order: Order,
        available_amount: float,
        session: Session,
        stage_priority: Optional[str] = None
    ) -> Tuple[float, List[dict]]:
        """Розподіляє платіж на конкретне замовлення"""
        allocations = []
        remaining = available_amount
        
        bonus = order.price * 0.05
        advance_amount = bonus * 0.5
        final_amount = bonus * 0.5
        
        # Аванс
        if (stage_priority is None or stage_priority == "advance"):
            advance_remaining = max(0, advance_amount - order.advance_paid_amount)
            if advance_remaining > 0 and remaining > 0:
                allocation = min(remaining, advance_remaining)
                order.advance_paid_amount += allocation
                remaining -= allocation
                
                # Якщо оплачено повністю, поставити дату
                if order.advance_paid_amount >= advance_amount and not order.date_advance_paid:
                    order.date_advance_paid = date.today()
                
                allocations.append({
                    "order_id": order.id,
                    "order_name": order.name,
                    "stage": "advance",
                    "amount": allocation
                })
        
        # Фінальна оплата
        if (stage_priority is None or stage_priority == "final"):
            final_remaining = final_amount - order.final_paid_amount
            if final_remaining > 0 and remaining > 0:
                allocation = min(remaining, final_remaining)
                order.final_paid_amount += allocation
                remaining -= allocation
                
                # Якщо оплачено повністю, поставити дату
                if order.final_paid_amount >= final_amount and not order.date_final_paid:
                    order.date_final_paid = date.today()
                
                allocations.append({
                    "order_id": order.id,
                    "order_name": order.name,
                    "stage": "final",
                    "amount": allocation
                })
        
        session.add(order)
        
        return remaining, allocations
