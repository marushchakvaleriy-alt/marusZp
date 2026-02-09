import os
import shutil
from typing import List, Optional
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select, desc, asc
from sqlalchemy import text
from database import get_session
from models import Order, OrderCreate, OrderRead, OrderUpdate, Deduction, DeductionCreate, DeductionRead, DeductionUpdate, ActivityLog, ActivityLogRead, OrderFile, OrderFileCreate, OrderFileRead, User, UserCreate, UserRead, UserUpdate
from payments import Payment, PaymentAllocation, PaymentRead
from payment_service import PaymentDistributionService
from pydantic import BaseModel
from auth import get_current_user, get_admin_user, get_manager_user, create_access_token, verify_password, get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES
from settings import load_settings, save_settings, Settings
from file_utils import ensure_project_structure, get_file_path, sanitize_filename
from telegram_service import TelegramService

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
        role=user.role,
        card_number=user.card_number,
        email=user.email,
        phone_number=user.phone_number
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
    notes: Optional[str] = None
    manual_order_id: Optional[int] = None  # Якщо вказано, розподіл на конкретне замовлення
    constructor_id: Optional[int] = None # Якщо вказано, розподіл по замовленнях цього конструктора

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

    logs.append("--- STARTING MANUAL MIGRATION (VERSION 3 - QUOTED USER) ---")
    
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

    # 3. Payment Columns (allocated_automatically, notes, manual_order_id)
    logs.append("Checking Payment table columns...")
    run_sql('ALTER TABLE payment ADD COLUMN IF NOT EXISTS allocated_automatically BOOLEAN DEFAULT TRUE')
    run_sql('ALTER TABLE payment ADD COLUMN allocated_automatically BOOLEAN DEFAULT 1') 
    
    run_sql('ALTER TABLE payment ADD COLUMN IF NOT EXISTS notes VARCHAR')
    run_sql('ALTER TABLE payment ADD COLUMN notes TEXT')
    
    run_sql('ALTER TABLE payment ADD COLUMN IF NOT EXISTS manual_order_id INTEGER REFERENCES "order"(id)')
    # Fallback without FK (safest for SQLite updates)
    run_sql('ALTER TABLE payment ADD COLUMN manual_order_id INTEGER')
    
    run_sql('ALTER TABLE payment ADD COLUMN IF NOT EXISTS constructor_id INTEGER REFERENCES "user"(id)')
    run_sql('ALTER TABLE payment ADD COLUMN constructor_id INTEGER')

    # 4. User Columns (card_number, email)
    logs.append("Checking User table columns...")
    
    # Try multiple variants for the table name
    user_variants = ['"user"', 'public."user"', 'user']
    
    for variant in user_variants:
        try:
            logs.append(f"Trying table name: {variant}")
            # Use distinct run for each column to avoid one failure blocking others
            session.connection().execute(text(f'ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS card_number VARCHAR'))
            session.connection().execute(text(f'ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS email VARCHAR'))
            session.connection().execute(text(f'ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS phone_number VARCHAR'))
            session.connection().execute(text(f'ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS telegram_id VARCHAR'))
            session.commit()
            logs.append(f"SUCCESS with {variant}")
            break # Stop if one worked
        except Exception as e:
            session.rollback()
            logs.append(f"Failed with {variant}: {str(e)}")
            
    # Also add text columns separately just in case
    try:
        variant = '"user"' # Most likely correct
        session.connection().execute(text(f'ALTER TABLE {variant} ADD COLUMN card_number TEXT'))
        session.connection().execute(text(f'ALTER TABLE {variant} ADD COLUMN email TEXT'))
        session.connection().execute(text(f'ALTER TABLE {variant} ADD COLUMN phone_number TEXT'))
        session.commit()
    except:
        session.rollback()

    # 5. Create Default Admin if missing
    logs.append("Checking for admin user...")
    try:
        admin_exists = session.exec(select(User).where(User.username == "admin")).first()
        if not admin_exists:
            from auth import get_password_hash
            # User is already imported globally
            logs.append("Admin not found. Creating default admin...")
            admin_user = User(
                username="admin",
                password_hash=get_password_hash("admin"),
                full_name="Administrator",
                role="admin"
            )
            session.add(admin_user)
            session.commit()
            logs.append("SUCCESS: Created admin / admin")
        else:
            logs.append("Admin already exists.")
    except Exception as e:
        logs.append(f"FAILED to check/create admin: {str(e)}")
        session.rollback()

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
        
        # Auto-create folder structure
        try:
            settings = load_settings()
            ensure_project_structure(db_order.name, settings.storage_path)
        except Exception as e:
            print(f"Failed to create folders: {e}")
        
        # Log activity
        log_activity(session, "CREATE_ORDER", f"Створено замовлення #{db_order.id} '{db_order.name}' (Автор: {current_user.username})")
        
        # Get constructor for configuration
        constructor = session.get(User, db_order.constructor_id) if db_order.constructor_id else None
        
        # 🟢 CRITICAL FIX: Freeze stage settings at creation time
        # If constructor exists, copy their current stage settings to the order
        if constructor:
            # Only set if not already provided in the request
            if db_order.custom_stage1_percent is None:
                db_order.custom_stage1_percent = constructor.payment_stage1_percent
            
            if db_order.custom_stage2_percent is None:
                db_order.custom_stage2_percent = constructor.payment_stage2_percent
            
            session.add(db_order)
            session.commit()
            session.refresh(db_order)

        return OrderRead.from_order(db_order, constructor)
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
    sort_by: str = "id",
    sort_order: str = "asc",
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
        
        # Sorting
        sort_col = Order.id
        if sort_by == "name":
            sort_col = Order.name
        
        if sort_order == "desc":
            query = query.order_by(desc(sort_col))
        else:
            query = query.order_by(asc(sort_col))

        query = query.offset(skip).limit(limit)
        
        orders = session.exec(query).all()
        # Convert using the logic-heavy from_order method
        # Return list with constructor-aware bonus calculation
        result = []
        for o in orders:
            constructor = None
            if o.constructor_id:
                # FORCE REFRESH: Use populate_existing=True to bypass session cache completely
                # This ensures we get the latest payment_stage percentages from DB
                constructor = session.exec(
                    select(User)
                    .where(User.id == o.constructor_id)
                    .execution_options(populate_existing=True)
                ).first()
            
            result.append(OrderRead.from_order(o, constructor))
        return result
    except Exception as e:
        print(f"ERROR READING ORDERS: {e}")
        return []

@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: int, 
    user_update: UserUpdate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_admin_user)
):
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_update.dict(exclude_unset=True)
    
    if "password" in update_data:
        password = update_data.pop("password")
        if password: # Only if string is not empty
            db_user.password_hash = get_password_hash(password)
    
    for key, value in update_data.items():
        setattr(db_user, key, value)
    
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    
    log_activity(session, "UPDATE_USER", f"Оновлено профіль {db_user.username} (Адмін: {current_user.username})")
    return db_user

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
    constructor = session.get(User, order.constructor_id) if order.constructor_id else None
    return OrderRead.from_order(order, constructor)

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
    
    # 🟢 CRITICAL FIX: If constructor changed, update stage defaults
    # This ensures new settings apply when assigning a constructor later
    if "constructor_id" in order_data:
        new_constructor_id = order_data["constructor_id"]
        if new_constructor_id:
            new_constructor = session.get(User, new_constructor_id)
            if new_constructor:
                # Only if not manually overriding in this same update (although UserUpdate doesn't support custom stages yet usually)
                # And if current order doesn't have custom stages?
                # Actually, simpler: If assigning new constructor, RESET to their defaults.
                # If manager wants custom, they'd have to set it separately.
                # But to be safe, only set if they are currently None or if we assume reassignment means "use new defaults"
                # Let's overwrite to be safe and ensure 100/0 applies.
                db_order.custom_stage1_percent = new_constructor.payment_stage1_percent
                db_order.custom_stage2_percent = new_constructor.payment_stage2_percent
    
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
    
    constructor = session.get(User, db_order.constructor_id) if db_order.constructor_id else None
    return OrderRead.from_order(db_order, constructor)

@router.delete("/orders/{order_id}")
def delete_order(order_id: int, session: Session = Depends(get_session)):
    db_order = session.get(Order, order_id)
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order_name = db_order.name # Save name for log
    
    # Manually delete orphans just in case
    from sqlalchemy import text
    try:
        session.exec(text(f"DELETE FROM deduction WHERE order_id = {order_id}")) # Fines
        session.exec(text(f"DELETE FROM paymentallocation WHERE order_id = {order_id}")) # Allocations
        session.exec(text(f"DELETE FROM orderfile WHERE order_id = {order_id}")) # Files
        
        # Unlink manual payments (don't delete the money, just unlink order)
        session.exec(text(f"UPDATE payment SET manual_order_id = NULL WHERE manual_order_id = {order_id}"))
        session.commit()
    except Exception as e:
        print(f"Error cleaning up order dependencies: {e}")
        session.rollback()

    session.delete(db_order)
    session.commit()
    log_activity(session, "DELETE_ORDER", f"Видалено замовлення #{order_id} '{order_name}'")
    return {"message": "Order deleted successfully"}

# Payment endpoints
@router.post("/payments/")
def create_payment(payment_data: PaymentCreate, session: Session = Depends(get_session)):
    """Додати платіж і автоматично розподілити його"""
    try:
        payment = Payment(
            amount=payment_data.amount,
            date_received=payment_data.date_received,
            notes=payment_data.notes,
            allocated_automatically=payment_data.manual_order_id is None,
            manual_order_id=payment_data.manual_order_id,
            constructor_id=payment_data.constructor_id
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
        
        # Notify Constructors regarding allocations
        try:
            ts = TelegramService()
            for alloc in allocations:
                order = session.get(Order, alloc.get("order_id")) # Alloc dict from service
                if order and order.constructor_id:
                    constructor = session.get(User, order.constructor_id)
                    if constructor:
                         ts.notify_payment(payment, alloc.get("amount"), order.name, constructor)
        except Exception as e:
             print(f"Failed to send payment notifications: {e}")

        return {
            "payment_id": payment.id,
            "allocations": allocations,
            "remaining_amount": remaining,
            "message": f"Платіж розподілено. Залишок: {remaining:.2f} грн" if remaining > 0 else "Платіж повністю розподілено"
        }
    except Exception as e:
        session.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Payment Error: {str(e)}")

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
    
    # --- TARGETED UNDO STRATEGY ---
    # Instead of resetting everything, we only undo THIS payment's effect.
    
    # 1. Find what this payment paid for
    allocations = session.exec(
        select(PaymentAllocation).where(PaymentAllocation.payment_id == payment_id)
    ).all()
    
    for alloc in allocations:
        # Get the order
        order = session.get(Order, alloc.order_id)
        if not order:
            continue
            
        # Calculate totals to check if we need to remove "Paid" date
        bonus = order.price * 0.05
        advance_required = bonus * 0.5
        final_required = bonus * 0.5
        
        # Revert amounts
        if alloc.stage == 'advance':
            order.advance_paid_amount = max(0, order.advance_paid_amount - alloc.amount)
            # If now less than required, remove date
            if order.advance_paid_amount < (advance_required - 0.01):
                order.date_advance_paid = None
                
        elif alloc.stage == 'final':
            order.final_paid_amount = max(0, order.final_paid_amount - alloc.amount)
            # If now less than required, remove date
            if order.final_paid_amount < (final_required - 0.01):
                order.date_final_paid = None
                
        session.add(order)
        # Delete this allocation record
        session.delete(alloc)
        
    # 2. Finally delete the payment itself
    session.delete(payment)
    session.commit()
    
    # 3. NO redistribution. 
    # Whatever happened is done. If holes appeared, they stay as debt.
    
    log_activity(session, "DELETE_PAYMENT", f"Видалено платіж {amount} грн від {date_} (Точкове скасування)")
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
    
    # Notify Constructor about Fine
    if order.constructor_id:
        constructor = session.get(User, order.constructor_id)
        if constructor:
            try:
                TelegramService().notify_deduction(deduction, order.name, constructor)
            except Exception as e:
                print(f"Failed to send deduction notification: {e}")

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
        # Global Stats for everyone (Admin, Manager, Constructor)
        # As per user request: "constructors ... should see figures of general debt and undistributed funds"
        total_received = session.exec(select(func.sum(Payment.amount))).one()
        total_allocated = session.exec(select(func.sum(PaymentAllocation.amount))).one()
        # Count all unpaid deductions as "Total Debt" (or use calculated net debt?)
        # Logic in frontend uses complex calc for "Total Debt". Backend just sends raw numbers usually?
        # Wait, get_financial_stats sends "total_deductions". Frontend calculates "Total Debt" from ORDERS.
        # So backend just needs to return valid global numbers for 'unallocated'.
        
        total_deductions = session.exec(select(func.sum(Deduction.amount)).where(Deduction.is_paid == False)).one()
        
        if total_received is None: total_received = 0.0
        if total_allocated is None: total_allocated = 0.0
        if total_deductions is None: total_deductions = 0.0
        
        unallocated = total_received - total_allocated
        
        
        # Calculate Global Total Debt (Sum of all constructor net debts)
        # We need to iterate all constructors first
        
        # Per-Constructor Stats
        constructors_stats = []
        constructors = session.exec(select(User).where(User.role == 'constructor')).all()
        
        global_total_debt = 0.0
        
        for c in constructors:
            # 1. Undistributed
            c_payments = session.exec(select(Payment).where(Payment.constructor_id == c.id)).all()
            c_total_received = sum(p.amount for p in c_payments)
            
            # Find allocations for these payments
            c_payment_ids = [p.id for p in c_payments]
            if c_payment_ids:
                c_total_allocated = session.exec(
                    select(func.sum(PaymentAllocation.amount))
                    .where(PaymentAllocation.payment_id.in_(c_payment_ids))
                ).one() or 0.0
            else:
                c_total_allocated = 0.0
                
            c_unallocated = c_total_received - c_total_allocated
            
            # 2. Debt (Unpaid salary for their orders)
            c_orders = session.exec(select(Order).where(Order.constructor_id == c.id)).all()
            c_debt = 0.0
            
            for o in c_orders:
                # Calculate bonus using same logic as OrderRead.from_order
                if o.fixed_bonus is not None:
                    # Manager override: use exact fixed amount
                    bonus = o.fixed_bonus
                elif c and hasattr(c, 'salary_mode') and hasattr(c, 'salary_percent'):
                    # Calculate based on constructor's salary configuration
                    if c.salary_mode == 'fixed_amount':
                        # Fixed amount per order
                        bonus = c.salary_percent
                    elif c.salary_mode == 'materials_percent':
                        # Calculate from material cost
                        bonus = (o.material_cost or 0) * (c.salary_percent / 100)
                    else:
                        # Default: calculate from sales price (sales_percent)
                        bonus = o.price * (c.salary_percent / 100)
                else:
                    # Fallback to old logic (5% of sales price)
                    bonus = o.price * 0.05
                
                # Determine stage distribution percentages
                if o.custom_stage1_percent is not None:
                    # Per-order override
                    stage1_pct = o.custom_stage1_percent
                    stage2_pct = o.custom_stage2_percent if o.custom_stage2_percent is not None else (100 - stage1_pct)
                elif c and hasattr(c, 'payment_stage1_percent'):
                    # Use constructor's default stage distribution
                    stage1_pct = c.payment_stage1_percent
                    stage2_pct = c.payment_stage2_percent
                else:
                    # Fallback: 50/50
                    stage1_pct = 50.0
                    stage2_pct = 50.0
                
                # Calculate stage amounts
                advance_amount = bonus * (stage1_pct / 100)
                final_amount = bonus * (stage2_pct / 100)
                
                advance_remaining = max(0, advance_amount - o.advance_paid_amount)
                final_remaining = max(0, final_amount - o.final_paid_amount)
                
                order_current_debt = 0.0
                if o.date_to_work and advance_remaining > 0.01:
                     order_current_debt += advance_remaining
                if o.date_installation and final_remaining > 0.01:
                     order_current_debt += final_remaining
                
                # Deduct unpaid fines
                unpaid_fines = session.exec(
                    select(func.sum(Deduction.amount))
                    .where(Deduction.order_id == o.id)
                    .where(Deduction.is_paid == False)
                ).one() or 0.0
                
                # Net debt for this order (salary - fines)
                # Allow NEGATIVE debt (User owes company) to subtract from total
                # Previously: max(0, ...)
                c_debt += (order_current_debt - unpaid_fines)

            # Add to global sum (only if positive? No, net it out!)
            # Actually, "Total Debt" usually implies "How much WE have to pay out".
            # If a constructor has negative debt (owes us), it reduces our valid liability?
            # Or should it be treated as 0 liablity and separate Receivable?
            # User expectation seems to be simpler NET math.
            global_total_debt += max(0, c_debt) # Global debt is what WE OWE. If he owes us, we owe 0.
            
            # LOGIC CHANGE: If constructor owes money (negative debt), 
            # move that amount to "Unallocated" (Вільні) and set debt to 0.
            if c_debt < 0:
                c_unallocated += abs(c_debt)
                c_debt = 0.0

            constructors_stats.append({
                "id": c.id,
                "name": c.full_name or c.username,
                "unallocated": c_unallocated,
                "debt": c_debt 
            })
        
        return {
            "total_received": total_received,
            "total_allocated": total_allocated,
            "unallocated": unallocated,
            "total_deductions": total_deductions,
            "total_debt": global_total_debt, # New field for frontend
            "constructors_stats": constructors_stats
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


# --- BACKUP ---
@router.get("/admin/backup")
def backup_database(current_user: User = Depends(get_admin_user), session: Session = Depends(get_session)):
    from datetime import datetime
    from fastapi.responses import JSONResponse
    
    # 1. Fetch all data
    users = session.exec(select(User)).all()
    orders = session.exec(select(Order)).all()
    payments = session.exec(select(Payment)).all()
    allocations = session.exec(select(PaymentAllocation)).all()
    deductions = session.exec(select(Deduction)).all()
    logs = session.exec(select(ActivityLog)).all()
    files = session.exec(select(OrderFile)).all()
    
    # 2. Serialize (using SQLModel's .dict() or similar)
    # We use jsonable_encoder to handle datetime serialization automatically
    from fastapi.encoders import jsonable_encoder
    
    backup_data = {
        "timestamp": datetime.now().isoformat(),
        "version": "1.0",
        "data": {
            "users": jsonable_encoder(users),
            "orders": jsonable_encoder(orders),
            "payments": jsonable_encoder(payments),
            "allocations": jsonable_encoder(allocations),
            "deductions": jsonable_encoder(deductions),
            "activity_logs": jsonable_encoder(logs),
            "order_files": jsonable_encoder(files)
        }
    }
    
    # 3. Return as downloadable file
    filename = f"backup_{datetime.now().strftime('%Y-%m-%d_%H-%M')}.json"
    
    return JSONResponse(
        content=backup_data,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/admin/restore")
def restore_database(file: UploadFile = File(...), current_user: User = Depends(get_admin_user), session: Session = Depends(get_session)):
    import json
    from sqlmodel import delete
    
    # 1. Read and parse JSON
    try:
        content = file.file.read()
        backup = json.loads(content)
        data = backup.get("data")
        if not data:
            raise ValueError("Invalid backup format: missing 'data' field")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid backup file: {e}")
        
    # 2. CLEAR ALL DATA (Order matters for Foreign Keys!)
    # Child tables first
    session.exec(delete(PaymentAllocation))
    session.exec(delete(Deduction))
    session.exec(delete(OrderFile))
    session.exec(delete(ActivityLog))
    session.exec(delete(Payment))
    session.exec(delete(Order))
    session.exec(delete(User))
    
    try:
        # 3. RESTORE DATA (Parent tables first)
        
        # Helper to convert ID strings to ints if needed (JSON keys are always strings)
        # But here we are loading list of dicts, so IDs should be ints if validation passes.
        
        # USERS
        for item in data.get("users", []):
            session.add(User(**item))
        session.flush() # Ensure IDs are claimed
            
        # ORDERS
        for item in data.get("orders", []):
            # Handle date fields that might be strings in JSON
            # SQLModel/Pydantic should handle string->date conversion automatically usually
            # But let's be safe if needed. For now assume auto-conversion works.
            session.add(Order(**item))
        session.flush()

        # PAYMENTS
        for item in data.get("payments", []):
            session.add(Payment(**item))
        session.flush()

        # ALLOCATIONS
        for item in data.get("allocations", []):
            session.add(PaymentAllocation(**item))
        
        # DEDUCTIONS
        for item in data.get("deductions", []):
            session.add(Deduction(**item))
            
        # ACTIVITY LOGS
        for item in data.get("activity_logs", []):
            session.add(ActivityLog(**item))
            
        # FILES
        for item in data.get("order_files", []):
            session.add(OrderFile(**item))
            
        session.commit()
        
        log_activity(session, "SYSTEM_RESTORE", f"Базу даних відновлено з файлу {file.filename}")
        return {"message": "Database restored successfully", "details": f"Version: {backup.get('version')}, Timestamp: {backup.get('timestamp')}"}
        
    except Exception as e:
        session.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")


# --- ADMIN SETTINGS ---
@router.get("/admin/settings", response_model=Settings)
def get_settings(current_user: User = Depends(get_admin_user)):
    return load_settings()

@router.post("/admin/settings", response_model=Settings)
def update_settings(settings: Settings, current_user: User = Depends(get_admin_user)):
    save_settings(settings)
    return settings

# --- FILE UPLOAD / DOWNLOAD ---

@router.post("/orders/{order_id}/upload")
async def upload_file(
    order_id: int, 
    folder_category: str,
    file: UploadFile = File(...), 
    session: Session = Depends(get_session)
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    settings = load_settings()
    
    # Ensure structure exists (just in case)
    ensure_project_structure(order.name, settings.storage_path)
    
    # Save file
    safe_filename = sanitize_filename(file.filename)
    file_path = get_file_path(order.name, folder_category, safe_filename, settings.storage_path)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")
        
    # Create DB Link
    # We store a special URL that points to our download endpoint
    # Format: /api/download/{order_id}/{category}/{filename}
    download_url = f"/api/download/{order_id}/{folder_category}/{safe_filename}"
    
    new_file = OrderFile(
        order_id=order_id,
        name=safe_filename,
        url=download_url,
        folder_name=folder_category
    )
    session.add(new_file)
    session.commit()
    session.refresh(new_file)
    
    log_activity(session, "UPLOAD_FILE", f"Завантажено файл '{safe_filename}' у '{folder_category}'")
    return new_file

@router.get("/download/{order_id}/{folder_category}/{filename}")
def download_file(order_id: int, folder_category: str, filename: str, session: Session = Depends(get_session)):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    settings = load_settings()
    safe_filename = sanitize_filename(filename)
    file_path = get_file_path(order.name, folder_category, safe_filename, settings.storage_path)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
        
    return FileResponse(path=file_path, filename=safe_filename)

@router.get("/debug/force_fix")
def debug_force_fix(session: Session = Depends(get_session)):
    report = []
    try:
        # 1. Check Marushchak
        query = select(User).where(User.full_name.contains("арущак"))
        user = session.exec(query).first()
        
        if user:
            report.append(f"Found User: {user.full_name} (ID: {user.id})")
            report.append(f"CURRENT DB SETTINGS: Stage1={user.payment_stage1_percent}%, Stage2={user.payment_stage2_percent}%")
            
            if user.payment_stage1_percent != 100.0:
                report.append("❌ Settings are WRONG! Forcing update...")
                user.payment_stage1_percent = 100.0
                user.payment_stage2_percent = 0.0
                session.add(user)
                session.commit()
                session.refresh(user)
                report.append(f"✅ UPDATED TO: Stage1={user.payment_stage1_percent}%, Stage2={user.payment_stage2_percent}%")
            else:
                report.append("✅ Settings are ALREADY CORRECT (100/0).")
                
            # Double check with a test query
            check = session.get(User, user.id)
            report.append(f"VERIFICATION READ: Stage1={check.payment_stage1_percent}%")
            
        else:
            report.append("❌ User 'Marushchak' NOT FOUND!")

        # 2. Check Order #17
        try:
            o17 = session.get(Order, 17)
            if o17:
                report.append(f"Order #17: Custom1={o17.custom_stage1_percent}, Custom2={o17.custom_stage2_percent}")
                # Force fix order 17 too
                if o17.custom_stage1_percent != 100.0:
                    o17.custom_stage1_percent = 100.0
                    o17.custom_stage2_percent = 0.0
                    session.add(o17)
                    session.commit()
                    report.append("✅ Fixed Order #17 to 100/0")
            else:
                report.append("Order #17 not found")
        except Exception as e:
            report.append(f"Error checking Order #17: {e}")

    except Exception as e:
        report.append(f"CRITICAL ERROR: {e}")
        import traceback
        report.append(traceback.format_exc())
    
    return {"report": report}
