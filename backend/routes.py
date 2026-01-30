import os
import shutil
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from database import get_session
from models import Order, OrderCreate, OrderRead, OrderUpdate, Deduction, DeductionCreate, DeductionRead, DeductionUpdate, ActivityLog, ActivityLogRead, OrderFile, OrderFileCreate, OrderFileRead
from payments import Payment, PaymentAllocation, PaymentRead
from payment_service import PaymentDistributionService
from pydantic import BaseModel

router = APIRouter()

# Payment DTOs
class PaymentCreate(BaseModel):
    amount: float
    date_received: date
    notes: Optional[str] = None
    manual_order_id: Optional[int] = None  # Якщо вказано, розподіл на конкретне замовлення

def log_activity(session: Session, action_type: str, description: str, details: Optional[str] = None):
    try:
        log = ActivityLog(action_type=action_type, description=description, details=details)
        session.add(log)
        session.commit()
    except Exception as e:
        print(f"Failed to log activity: {e}")

@router.get("/logs", response_model=List[ActivityLogRead])
def get_logs(session: Session = Depends(get_session)):
    return session.exec(select(ActivityLog).order_by(ActivityLog.timestamp.desc(), ActivityLog.id.desc())).all()

@router.post("/orders/", response_model=OrderRead)
def create_order(order: OrderCreate, session: Session = Depends(get_session)):
    db_order = Order.from_orm(order)
    session.add(db_order)
    session.commit()
    session.refresh(db_order)
    log_activity(session, "CREATE_ORDER", f"Створено замовлення #{db_order.id} '{db_order.name}'")
    return OrderRead.from_order(db_order)

@router.get("/orders/", response_model=List[OrderRead])
def read_orders(session: Session = Depends(get_session)):
    orders = session.exec(select(Order)).all()
    return [OrderRead.from_order(order) for order in orders]

@router.get("/orders/{order_id}", response_model=OrderRead)
def read_order(order_id: int, session: Session = Depends(get_session)):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderRead.from_order(order)

@router.patch("/orders/{order_id}", response_model=OrderRead)
def update_order(order_id: int, order_update: OrderUpdate, session: Session = Depends(get_session)):
    db_order = session.get(Order, order_id)
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Track if dates changed
    old_date_to_work = db_order.date_to_work
    old_date_installation = db_order.date_installation
    
    
    order_data = order_update.dict(exclude_unset=True)
    
    # Check if ID change is requested
    new_id = order_data.get("id")
    if new_id is not None and new_id != order_id:
        # Check if new ID exists
        existing = session.get(Order, new_id)
        if existing:
            raise HTTPException(status_code=400, detail=f"ID {new_id} вже зайнятий")
        
        # We need to use raw SQL to update PK and cascade to deductions
        # First update deductions to point to new ID (we do this in transaction)
        # Actually, standard SQL update on parent with CASCADE is best, but we simulate it:
        
        # 1. Update Order ID (SQLAlchemy doesn't like PK change on object)
        from sqlalchemy import text
        session.exec(text(f"UPDATE deduction SET order_id = {new_id} WHERE order_id = {order_id}"))
        session.exec(text(f"UPDATE \"order\" SET id = {new_id} WHERE id = {order_id}")) # Quote table name 'order'
        session.commit()
        
        # Re-fetch new order
        db_order = session.get(Order, new_id)
        order_id = new_id # Update local var
        # Remove id from order_data to avoid re-update error logic
        del order_data["id"] 

    for key, value in order_data.items():
        if key != "id": # Skip ID as handled above
            setattr(db_order, key, value)
    
    session.add(db_order)
    session.commit()
    session.refresh(db_order)
    
    # If work dates changed, trigger redistribution
    dates_changed = (
        db_order.date_to_work != old_date_to_work or 
        db_order.date_installation != old_date_installation
    )
    if dates_changed:
        PaymentDistributionService.distribute_all_unallocated(session)
    
    return OrderRead.from_order(db_order)

@router.delete("/orders/{order_id}")
def delete_order(order_id: int, session: Session = Depends(get_session)):
    db_order = session.get(Order, order_id)
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order_name = db_order.name # Save name for log
    session.delete(db_order)
    session.commit()
    log_activity(session, "DELETE_ORDER", f"Видалено замовлення #{order_id} '{order_name}'")
    return {"message": "Order deleted successfully"}

# Payment endpoints
@router.post("/payments/")
def create_payment(payment_data: PaymentCreate, session: Session = Depends(get_session)):
    """Додати платіж і автоматично розподілити його"""
    payment = Payment(
        amount=payment_data.amount,
        date_received=payment_data.date_received,
        notes=payment_data.notes,
        allocated_automatically=payment_data.manual_order_id is None
    )
    session.add(payment)
    session.commit()
    session.refresh(payment)
    
    # Розподілити ВСІ доступні кошти (включаючи старі залишки)
    allocations = PaymentDistributionService.distribute_all_unallocated(session)
    
    # Calculate remaining specifically for THIS payment for response (just for UI)
    existing_allocs = session.exec(
        select(PaymentAllocation).where(PaymentAllocation.payment_id == payment.id)
    ).all()
    used = sum(a.amount for a in existing_allocs)
    remaining = payment.amount - used
    
    log_activity(session, "ADD_PAYMENT", f"Додано платіж {payment.amount} грн")
    return {
        "payment_id": payment.id,
        "allocations": allocations, # This might return allocations from OTHER payments too, but for UI feedback it shows "what happened now"
        "remaining_amount": remaining,
        "message": f"Платіж розподілено. Залишок: {remaining:.2f} грн" if remaining > 0 else "Платіж повністю розподілено"
    }
    
    
    log_activity(session, "ADD_PAYMENT", f"Додано платіж {payment.amount} грн")
    return {
        "payment_id": payment.id,
        "allocations": allocations,
        "remaining_amount": remaining,
        "message": f"Платіж розподілено. Залишок: {remaining:.2f} грн" if remaining > 0 else "Платіж повністю розподілено"
    }

@router.get("/payments/", response_model=List[PaymentRead])
def get_payments(session: Session = Depends(get_session)):
    """Отримати історію всіх платежів"""
    payments = session.exec(select(Payment).order_by(Payment.date_received.desc())).all()
    return payments

@router.get("/payments/{payment_id}/allocations")
def get_payment_allocations(payment_id: int, session: Session = Depends(get_session)):
    """Отримати розподіл конкретного платежу"""
    allocations = session.exec(
        select(PaymentAllocation).where(PaymentAllocation.payment_id == payment_id)
    ).all()
    
    result = []
    for alloc in allocations:
        order = session.get(Order, alloc.order_id)
        result.append({
            "order_id": alloc.order_id,
            "order_name": order.name if order else "Unknown",
            "stage": "Аванс" if alloc.stage == "advance" else "Фінальна оплата",
            "amount": alloc.amount
        })
    
    return result

@router.post("/payments/redistribute")
def redistribute_payments(session: Session = Depends(get_session)):
    """Примусово перерозподілити всі наявні платежі"""
    allocations = PaymentDistributionService.distribute_all_unallocated(session)
    
    # Calculate total unallocated
    payments = session.exec(select(Payment)).all()
    total_received = sum(p.amount for p in payments)
    
    all_allocations = session.exec(select(PaymentAllocation)).all()
    total_allocated = sum(a.amount for a in all_allocations)
    
    unallocated = total_received - total_allocated
    
    log_activity(session, "REDISTRIBUTE", f"Перерозподілено {len(allocations)} транзакцій. Залишок: {unallocated:.2f} грн")
    
    return {
        "allocations_made": len(allocations),
        "unallocated_remaining": unallocated,
        "message": f"Розподіл завершено. Нерозподілено: {unallocated:.2f} грн"
    }

# File Management
# File Link Management
@router.get("/orders/{order_id}/files", response_model=List[OrderFileRead])
def get_order_files(order_id: int, session: Session = Depends(get_session)):
    return session.exec(select(OrderFile).where(OrderFile.order_id == order_id)).all()

@router.post("/orders/{order_id}/files", response_model=OrderFileRead)
def add_file_link(order_id: int, file_data: OrderFileCreate, session: Session = Depends(get_session)):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    new_file = OrderFile(
        order_id=order_id,
        name=file_data.name,
        url=file_data.url,
        folder_name=file_data.folder_name
    )
    session.add(new_file)
    session.commit()
    session.refresh(new_file)
    
    # Log action
    log_activity(session, "ADD_FILE", f"Додано посилання на файл '{new_file.name}' до замовлення '{order.name}'")
    
    return new_file

@router.delete("/files/{file_id}")
def delete_file_link(file_id: int, session: Session = Depends(get_session)):
    file_link = session.get(OrderFile, file_id)
    if not file_link:
        raise HTTPException(status_code=404, detail="File link not found")
        
    order = session.get(Order, file_link.order_id)
    order_name = order.name if order else "Unknown"
    file_name = file_link.name
    
    session.delete(file_link)
    session.commit()
    
    # Log action
    log_activity(session, "DELETE_FILE", f"Видалено посилання на файл '{file_name}' із замовлення '{order_name}'")
    
    return {"ok": True}

    


# Deduction endpoints
@router.post("/deductions/")
def create_deduction(deduction_data: DeductionCreate, session: Session = Depends(get_session)):
    # Verify order exists
    order = session.get(Order, deduction_data.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    deduction = Deduction(**deduction_data.dict())
    session.add(deduction)
    session.commit()
    session.refresh(deduction)
    
    order = session.get(Order, deduction.order_id)
    log_activity(session, "ADD_DEDUCTION", f"Додано штраф {deduction.amount} грн для замовлення '{order.name}'")
    return DeductionRead.from_deduction(deduction, order.name)

@router.get("/deductions/")
def get_deductions(order_id: int = None, session: Session = Depends(get_session)):
    if order_id:
        deductions = session.exec(
            select(Deduction).where(Deduction.order_id == order_id)
        ).all()
    else:
        deductions = session.exec(select(Deduction)).all()
    
    result = []
    for ded in deductions:
        order = session.get(Order, ded.order_id)
        result.append(DeductionRead.from_deduction(ded, order.name if order else "Unknown"))
    
    return result

@router.patch("/deductions/{deduction_id}")
def update_deduction(deduction_id: int, deduction_update: "DeductionUpdate", session: Session = Depends(get_session)):
    from models import DeductionUpdate
    
    deduction = session.get(Deduction, deduction_id)
    if not deduction:
        raise HTTPException(status_code=404, detail="Deduction not found")
    
    update_data = deduction_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(deduction, key, value)
    
    session.add(deduction)
    session.commit()
    session.refresh(deduction)
    
    order = session.get(Order, deduction.order_id)
    log_activity(session, "UPDATE_DEDUCTION", f"Оновлено штраф #{deduction_id}")
    return DeductionRead.from_deduction(deduction, order.name if order else "Unknown")

@router.delete("/deductions/{deduction_id}")
def delete_deduction(deduction_id: int, session: Session = Depends(get_session)):
    deduction = session.get(Deduction, deduction_id)
    if not deduction:
        raise HTTPException(status_code=404, detail="Deduction not found")
    
    deduction_amount = deduction.amount # Save for log
    session.delete(deduction)
    session.commit()
    
    log_activity(session, "DELETE_DEDUCTION", f"Видалено штраф #{deduction_id} ({deduction_amount} грн)")
    return {"message": "Deduction deleted successfully"}

@router.get("/stats/financial")
def get_financial_stats(session: Session = Depends(get_session)):
    from sqlalchemy import func
    from payments import Payment, PaymentAllocation
    
    try:
        total_received = session.exec(select(func.sum(Payment.amount))).one()
        total_allocated = session.exec(select(func.sum(PaymentAllocation.amount))).one()
        total_deductions = session.exec(select(func.sum(Deduction.amount)).where(Deduction.is_paid == False)).one()
        
        # one() on sum can return None if table is empty
        if total_received is None: total_received = 0.0
        if total_allocated is None: total_allocated = 0.0
        if total_deductions is None: total_deductions = 0.0
        
        # Unallocated funds = (Real payments received) - (Payments allocated to work)
        # Fines don't appear here - they only reduce debt on specific orders
        unallocated = total_received - total_allocated
        
        return {
            "total_received": total_received,
            "total_allocated": total_allocated,
            "unallocated": unallocated,
            "total_deductions": total_deductions
        }

    except Exception as e:
        print(f"Error calculating stats: {e}")
        return {
            "total_received": 0.0,
            "total_allocated": 0.0,
            "unallocated": 0.0
        }

class ResetRequest(BaseModel):
    password: str

@router.delete("/admin/reset")
def reset_database(request: ResetRequest, session: Session = Depends(get_session)):
    if request.password != "Gjksyrf":
        raise HTTPException(status_code=403, detail="Incorrect password")
    
    # Delete all data from tables in correct order (child first)
    from sqlmodel import delete
    
    session.exec(delete(PaymentAllocation))
    session.exec(delete(Deduction))
    session.exec(delete(OrderFile))
    session.exec(delete(ActivityLog))
    session.exec(delete(Payment))
    session.exec(delete(Order))
    
    session.commit()
    
    log_activity(session, "SYSTEM_RESET", "Всі дані було очищено адміністратором")
    return {"message": "All data has been reset"}

