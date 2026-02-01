import os
import shutil
from typing import List, Optional
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select, desc
from sqlalchemy import text
from database import get_session
from models import Order, OrderCreate, OrderRead, OrderUpdate, Deduction, DeductionCreate, DeductionRead, DeductionUpdate, ActivityLog, ActivityLogRead, OrderFile, OrderFileCreate, OrderFileRead, User, UserCreate, UserRead, UserUpdate
from payments import Payment, PaymentAllocation, PaymentRead
from payment_service import PaymentDistributionService
from pydantic import BaseModel
from auth import get_current_user, get_admin_user, get_manager_user, create_access_token, verify_password, get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()

# --- AUTH ROUTES ---

@router.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    print(f"--- LOGIN ATTEMPT ---")
    print(f"Username received: '{form_data.username}'")
    print(f"Password received: '{form_data.password}'")
    
    user = session.exec(select(User).where(User.username == form_data.username)).first()
    
    if not user:
        print("RESULT: User not found in DB!")
    else:
        print(f"User found: ID {user.id}, Role {user.role}")
        print(f"Stored Hash: {user.password_hash}")
        is_valid = verify_password(form_data.password, user.password_hash)
        print(f"Password Check: {'VALID' if is_valid else 'INVALID'}")
    print(f"Password Check: {'VALID' if is_valid else 'INVALID'}")
        
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    print("LOGIN SUCCESS")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users/me", response_model=UserRead)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# Admin only: Create User
@router.post("/users", response_model=UserRead)
def create_user(user: UserCreate, current_user: User = Depends(get_admin_user), session: Session = Depends(get_session)):
    db_user = session.exec(select(User).where(User.username == user.username)).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = User(
        username=user.username,
        password_hash=hashed_password,
        full_name=user.full_name,
        role=user.role
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user

@router.get("/users", response_model=List[UserRead])
def read_users(current_user: User = Depends(get_manager_user), session: Session = Depends(get_session)):
    users = session.exec(select(User)).all()
    return users

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

@router.get("/fix-db")
def fix_database_schema(session: Session = Depends(get_session)):
    logs = []
    
    # helper to run command
    def run_sql(sql):
        try:
            session.connection().execute(text(sql))
            session.commit()
            logs.append(f"SUCCESS: {sql}")
        except Exception as e:
            session.rollback()
            logs.append(f"FAILED: {sql} | Error: {str(e)}")

    logs.append("--- STARTING MANUAL MIGRATION ---")
    
    # 1. Constructor ID
    logs.append("Attempting to add constructor_id...")
    # Postgres specific try
    run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS constructor_id INTEGER')
    # Fallback (simple)
    run_sql('ALTER TABLE order ADD COLUMN constructor_id INTEGER')

    # 2. Date Design Deadline
    logs.append("Attempting to add date_design_deadline...")
    run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS date_design_deadline DATE')
    run_sql('ALTER TABLE order ADD COLUMN date_design_deadline DATE')

    return {"status": "completed", "logs": logs}

@router.get("/logs", response_model=List[ActivityLogRead])
def get_logs(session: Session = Depends(get_session)):
    return session.exec(select(ActivityLog).order_by(ActivityLog.timestamp.desc(), ActivityLog.id.desc())).all()

@router.post("/orders/", response_model=OrderRead)
def create_order(order: OrderCreate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    try:
        # Create DB model from input
        db_order = Order.from_orm(order)
        
        # Logic:
        # - Admin/Manager can assign anyone (via input)
        # - Constructor is forced to assign themselves
        if current_user.role == 'constructor':
            db_order.constructor_id = current_user.id
            
        session.add(db_order)
        session.commit()
        session.refresh(db_order)
        
        # Log activity
        log_activity(session, "CREATE_ORDER", f"Створено замовлення #{db_order.id} '{db_order.name}' (Автор: {current_user.username})")
        return OrderRead.from_order(db_order)
    except Exception as e:
        session.rollback()
        print(f"ERROR CREATING ORDER: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Creation Error: {str(e)}")

@router.get("/orders/", response_model=List[OrderRead])
def read_orders(
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    try:
        query = select(Order)
        
        # FILTER BY ROLE
        # Admin and Manager see ALL orders
        if current_user.role not in ['admin', 'manager']:
            print(f"Filtering orders for CONST ID: {current_user.id}")
            # Constructor sees only their assigned orders
            query = query.where(Order.constructor_id == current_user.id)
            
        if search:
            if search.isdigit():
                query = query.where(Order.id == int(search))
            else:
                query = query.where(Order.name.contains(search))
        
        # Sort by ID descending (newest first)
        query = query.order_by(desc(Order.id))
        query = query.offset(skip).limit(limit)
        
        orders = session.exec(query).all()
        # Convert using the logic-heavy from_order method
        return [OrderRead.from_order(o) for o in orders]
    except Exception as e:
        print(f"ERROR READING ORDERS: {e}")
        return []

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_admin_user) # Only admin can delete
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == "admin":
         raise HTTPException(status_code=400, detail="Cannot delete superadmin")
         
    session.delete(user)
    session.commit()
    log_activity(session, "DELETE_USER", f"Видалено користувача {user.username} (Адмін: {current_user.username})")
    return {"ok": True}


@router.get("/orders/{order_id}", response_model=OrderRead)
def read_order(order_id: int, session: Session = Depends(get_session)):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderRead.from_order(order)

@router.patch("/orders/{order_id}", response_model=OrderRead)
def update_order(
    order_id: int, 
    order_update: OrderUpdate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_order = session.get(Order, order_id)
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Track if dates changed
    old_date_to_work = db_order.date_to_work
    old_date_installation = db_order.date_installation
    
    order_data = order_update.dict(exclude_unset=True)
    
    # PERMISSION CHECK:
    # Only Admin/Manager can change constructor_id
    if "constructor_id" in order_data:
        if current_user.role not in ['admin', 'manager']:
            # Silent ignore or error? Let's ignore to prevent frontend crashes if it sends it inadvertently
            del order_data["constructor_id"]
    
    # Check if ID change is requested
    new_id = order_data.get("id")
    if new_id is not None and new_id != order_id:
        if current_user.role != 'admin': # Only Admin changes IDs
             raise HTTPException(status_code=403, detail="Only Admin can change Order IDs")

        # Check if new ID exists
        existing = session.get(Order, new_id)
        if existing:
            status_text = " (В АРХІВІ)" if (existing.date_advance_paid and existing.date_installation and existing.date_final_paid) else ""
            raise HTTPException(status_code=400, detail=f"ID {new_id} вже зайнятий замовленням '{existing.name}'{status_text}")
        
        # We need to use raw SQL to update PK and cascade to deductions
        from sqlalchemy import text
        session.exec(text(f"UPDATE deduction SET order_id = {new_id} WHERE order_id = {order_id}")) # deductions first
        session.exec(text(f"UPDATE order_file SET order_id = {new_id} WHERE order_id = {order_id}")) # files too
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
    
    log_activity(session, "UPDATE_ORDER", f"Оновлено замовлення #{order_id} (Користувач: {current_user.username})")
    
    return OrderRead.from_order(db_order)

@router.delete("/orders/{order_id}")
def delete_order(order_id: int, session: Session = Depends(get_session)):
    db_order = session.get(Order, order_id)
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order_name = db_order.name # Save name for log
    
    # Manually delete orphans just in case
    from sqlalchemy import text
    session.exec(text(f"DELETE FROM deduction WHERE order_id = {order_id}"))

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

@router.delete("/payments/{payment_id}")
def delete_payment(payment_id: int, session: Session = Depends(get_session)):
    """
    Видалити платіж і ПОВНІСТЮ перерахувати всі розподіли.
    Це необхідно для збереження коректності балансів (First-In-First-Out).
    """
    payment = session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    amount = payment.amount
    date_ = payment.date_received
    
    session.delete(payment)
    session.commit()
    
    # --- RESET WORLD STRATEGY ---
    # 1. Clear all allocations
    from sqlalchemy import text
    session.exec(text("DELETE FROM paymentallocation"))
    
    # 2. Reset order paid amounts and dates
    # We set them to 0 and NULL.
    # Note: If there are other sources of payments (e.g. deductions paid via other means?), this might correspond to only payments handled here.
    # Assuming all "advance/final" payments come through Payment system.
    session.exec(text("UPDATE \"order\" SET advance_paid_amount = 0, final_paid_amount = 0, date_advance_paid = NULL, date_final_paid = NULL"))
    
    session.commit()
    
    # 3. Recalculate everything
    PaymentDistributionService.distribute_all_unallocated(session)
    
    log_activity(session, "DELETE_PAYMENT", f"Видалено платіж {amount} грн від {date_} і перераховано баланси")
    return {"ok": True}

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
def get_financial_stats(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    from sqlalchemy import func
    from payments import Payment, PaymentAllocation
    
    try:
        # If Admin - Global Stats
        if current_user.role == 'admin':
            total_received = session.exec(select(func.sum(Payment.amount))).one()
            total_allocated = session.exec(select(func.sum(PaymentAllocation.amount))).one()
            total_deductions = session.exec(select(func.sum(Deduction.amount)).where(Deduction.is_paid == False)).one()
            
            if total_received is None: total_received = 0.0
            if total_allocated is None: total_allocated = 0.0
            if total_deductions is None: total_deductions = 0.0
            
            unallocated = total_received - total_allocated
            
            return {
                "total_received": total_received,
                "total_allocated": total_allocated,
                "unallocated": unallocated,
                "total_deductions": total_deductions
            }
        
        else:
            # Constructor - ONLY THEIR OWN TOTALS
            # This is tricky because payments are global. 
            # We will show sum of 'price' of their assigned orders as a proxy? 
            # OR show sum of allocations to THEIR orders.
            
            # Show sum of allocations to their orders (Actual money earned/allocated)
            my_allocations = session.exec(
                select(func.sum(PaymentAllocation.amount))
                .join(Order)
                .where(Order.constructor_id == current_user.id)
            ).one()
            
            # Show total price of their projects
            my_projects_value = session.exec(
                select(func.sum(Order.price))
                .where(Order.constructor_id == current_user.id)
            ).one()

            if my_allocations is None: my_allocations = 0.0
            if my_projects_value is None: my_projects_value = 0.0
            
            # Constructors shouldn't see 'unallocated' company money.
            return {
                "total_received": my_allocations, # Re-label for UI reuse
                "total_allocated": my_projects_value * 0.05, # Bonus potential? Or just 0
                "unallocated": 0.0,
                "total_deductions": 0.0 # Or specific fines
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

