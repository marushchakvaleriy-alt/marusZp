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
from models import Order, OrderCreate, OrderRead, OrderUpdate, Deduction, DeductionCreate, DeductionRead, DeductionUpdate, ActivityLog, ActivityLogRead, OrderFile, OrderFileCreate, OrderFileRead, User, UserCreate, UserRead, UserUpdate, OrderCalculationHistoryItemRead
from payments import Payment, PaymentAllocation, PaymentRead
from payment_service import PaymentDistributionService
from financial_logic import build_constructor_financial_snapshot, resolve_constructor_base_financials
from pydantic import BaseModel
from auth import get_current_user, get_admin_user, get_super_admin_user, get_manager_user, create_access_token, verify_password, get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES
from settings import load_settings, save_settings, Settings
from file_utils import ensure_project_structure, get_file_path, sanitize_filename, normalize_folder_category
from telegram_service import TelegramService

router = APIRouter()

ADMIN_ROLES = {"admin", "super_admin"}
MANAGER_ROLES = {"admin", "manager", "super_admin"}


def is_admin(user: User) -> bool:
    return user.role in ADMIN_ROLES


def can_access_order(user: User, order: Order) -> bool:
    return user.role in MANAGER_ROLES or order.constructor_id == user.id


def ensure_order_access(user: User, order: Order):
    if not can_access_order(user, order):
        raise HTTPException(status_code=403, detail="Access denied for this order")


def is_payment_visible_to_constructor(
    session: Session,
    payment: Payment,
    constructor_id: int
) -> bool:
    if payment.constructor_id == constructor_id:
        return True

    allocations = session.exec(
        select(PaymentAllocation).where(PaymentAllocation.payment_id == payment.id)
    ).all()
    if not allocations:
        return False

    order_ids = [a.order_id for a in allocations]
    if not order_ids:
        return False

    own_order = session.exec(
        select(Order.id)
        .where(Order.id.in_(order_ids))
        .where(Order.constructor_id == constructor_id)
        .limit(1)
    ).first()
    return own_order is not None

# --- AUTH ROUTES ---

@router.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    print(f"--- LOGIN ATTEMPT ---")
    login_value = (form_data.username or "").strip()
    print(f"Username received: '{login_value}'")

    user = session.exec(select(User).where(User.username == login_value)).first()
    # Support login by email as well, because users often enter email in the login field.
    if not user and "@" in login_value:
        user = session.exec(select(User).where(User.email == login_value)).first()

    is_valid = False
    if user:
        is_valid = verify_password(form_data.password, user.password_hash)

    if not user or not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
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

@router.delete("/users/{user_id}")
def delete_user(user_id: int, current_user: User = Depends(get_admin_user), session: Session = Depends(get_session)):
    user_to_delete = session.get(User, user_id)
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Protect critical accounts
    if user_to_delete.username == 'admin' or user_to_delete.role == 'super_admin':
        raise HTTPException(status_code=400, detail="Cannot delete admin/super-admin accounts")
        
    username = user_to_delete.username
    
    # Logic: If user is deleted, we should UNLINK them from orders and payments
    # (Setting to NULL instead of deleting orders/money)
    session.exec(text('UPDATE "order" SET constructor_id = NULL WHERE constructor_id = :user_id'), {"user_id": user_id})
    session.exec(text('UPDATE "order" SET manager_id = NULL WHERE manager_id = :user_id'), {"user_id": user_id})
    session.exec(text("UPDATE payment SET constructor_id = NULL WHERE constructor_id = :user_id"), {"user_id": user_id})
    session.exec(text("UPDATE payment SET manager_id = NULL WHERE manager_id = :user_id"), {"user_id": user_id})
    
    session.delete(user_to_delete)
    session.commit()
    
    log_activity(session, "DELETE_USER", f"Видалено користувача '{username}' (Видалив: {current_user.username})")
    return {"message": "User deleted successfully"}

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
    constructor_id: Optional[int] = None # Якщо вказано, розподіл по замовленнях цього конструктора
    manager_id: Optional[int] = None # Якщо вказано, розподіл по замовленнях цього менеджера

PAYMENT_SCHEMA_PATCHES = [
    ("allocated_automatically", "ALTER TABLE payment ADD COLUMN allocated_automatically BOOLEAN DEFAULT TRUE"),
    ("notes", "ALTER TABLE payment ADD COLUMN notes TEXT"),
    ("manual_order_id", "ALTER TABLE payment ADD COLUMN manual_order_id INTEGER"),
    ("constructor_id", "ALTER TABLE payment ADD COLUMN constructor_id INTEGER"),
    ("manager_id", "ALTER TABLE payment ADD COLUMN manager_id INTEGER"),
]

ORDER_PLANNING_SCHEMA_PATCHES = [
    (
        "constructive_days",
        (
            'ALTER TABLE "order" ADD COLUMN constructive_days INTEGER DEFAULT 5',
            "ALTER TABLE order ADD COLUMN constructive_days INTEGER DEFAULT 5",
        ),
    ),
    (
        "complectation_days",
        (
            'ALTER TABLE "order" ADD COLUMN complectation_days INTEGER DEFAULT 2',
            "ALTER TABLE order ADD COLUMN complectation_days INTEGER DEFAULT 2",
        ),
    ),
    (
        "preassembly_days",
        (
            'ALTER TABLE "order" ADD COLUMN preassembly_days INTEGER DEFAULT 1',
            "ALTER TABLE order ADD COLUMN preassembly_days INTEGER DEFAULT 1",
        ),
    ),
    (
        "installation_days",
        (
            'ALTER TABLE "order" ADD COLUMN installation_days INTEGER DEFAULT 3',
            "ALTER TABLE order ADD COLUMN installation_days INTEGER DEFAULT 3",
        ),
    ),
]


def ensure_payment_schema(session: Session):
    """Hot-fix old databases that miss newer payment columns."""
    for column_name, alter_sql in PAYMENT_SCHEMA_PATCHES:
        try:
            session.exec(text(f"SELECT {column_name} FROM payment LIMIT 1"))
        except Exception:
            session.rollback()
            try:
                session.connection().execute(text(alter_sql))
                session.commit()
            except Exception as e:
                session.rollback()
                err = str(e).lower()
                if "already exists" in err or "duplicate column" in err:
                    continue
                raise


def ensure_order_planning_schema(session: Session):
    """Ensure planning columns exist on older databases."""
    for column_name, alter_sqls in ORDER_PLANNING_SCHEMA_PATCHES:
        try:
            session.exec(text(f'SELECT {column_name} FROM "order" LIMIT 1'))
            continue
        except Exception:
            session.rollback()

        for sql in alter_sqls:
            try:
                session.connection().execute(text(sql))
                session.commit()
                break
            except Exception as e:
                session.rollback()
                err = str(e).lower()
                if "already exists" in err or "duplicate column" in err:
                    break


def log_activity(session: Session, action_type: str, description: str, details: Optional[str] = None):
    try:
        log = ActivityLog(action_type=action_type, description=description, details=details)
        session.add(log)
        session.commit()
    except Exception as e:
        print(f"Failed to log activity: {e}")

@router.get("/fix-db")
def fix_database_schema(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_admin_user)
):
    logs = []
    
    # helper to run command
    def run_sql(sql):
        try:
            # 💡 SQLite doesn't support 'IF NOT EXISTS' in ALTER TABLE
            # If we detect it and we are on SQLite, we might need a workaround.
            # But the simplest is to try with it, and if it fails with syntax, try without.
            session.connection().execute(text(sql))
            session.commit()
            logs.append(f"SUCCESS: {sql}")
        except Exception as e:
            session.rollback()
            err_msg = str(e).lower()
            
            # If it failed because of IF NOT EXISTS syntax (sqlite error)
            if "if not exists" in sql.lower() and ("syntax error" in err_msg or "near \"exists\"" in err_msg):
                # Try stripping IF NOT EXISTS
                cleaned_sql = sql.replace("IF NOT EXISTS ", "").replace("if not exists ", "")
                try:
                    session.connection().execute(text(cleaned_sql))
                    session.commit()
                    logs.append(f"SUCCESS (cleaned): {cleaned_sql}")
                    return
                except Exception as e2:
                    session.rollback()
                    err_msg2 = str(e2).lower()
                    # If it already exists, that's actually success for an "IF NOT EXISTS" intent
                    if "duplicate column" in err_msg2 or "already exists" in err_msg2:
                        logs.append(f"SKIPPED (already exists): {cleaned_sql}")
                        return
                    logs.append(f"FAILED (cleaned): {cleaned_sql} | Error: {str(e2)}")
            
            # If it failed because column already exists (postgres or cleaned sqlite)
            if "already exists" in err_msg or "duplicate column" in err_msg:
                logs.append(f"SKIPPED (already exists): {sql}")
            else:
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
    
    # 2b. Planned Installation Date (Manager View)
    logs.append("Attempting to add date_installation_plan...")
    run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS date_installation_plan DATE')
    run_sql('ALTER TABLE order ADD COLUMN date_installation_plan DATE')

    # 2b2. Planned Installation Duration (days)
    logs.append("Attempting to add installation_days...")
    run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS installation_days INTEGER DEFAULT 3')
    run_sql('ALTER TABLE order ADD COLUMN installation_days INTEGER DEFAULT 3')

    # 2b3. Planned stage durations for Gantt pipeline
    logs.append("Attempting to add constructive/complectation/preassembly days...")
    run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS constructive_days INTEGER DEFAULT 5')
    run_sql('ALTER TABLE order ADD COLUMN constructive_days INTEGER DEFAULT 5')
    run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS complectation_days INTEGER DEFAULT 2')
    run_sql('ALTER TABLE order ADD COLUMN complectation_days INTEGER DEFAULT 2')
    run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS preassembly_days INTEGER DEFAULT 1')
    run_sql('ALTER TABLE order ADD COLUMN preassembly_days INTEGER DEFAULT 1')
    
    # 2c. Material Cost
    logs.append("Attempting to add material_cost...")
    run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS material_cost FLOAT DEFAULT 0.0')
    run_sql('ALTER TABLE order ADD COLUMN material_cost REAL DEFAULT 0.0')
    
    # 2d. Manager ID
    logs.append("Attempting to add manager_id...")
    run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS manager_id INTEGER')
    run_sql('ALTER TABLE order ADD COLUMN manager_id INTEGER')
    
    # 2e. Manager Paid Amount
    logs.append("Attempting to add manager_paid_amount...")
    run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS manager_paid_amount FLOAT DEFAULT 0.0')
    run_sql('ALTER TABLE order ADD COLUMN manager_paid_amount REAL DEFAULT 0.0')
    
    # 2f. Date Manager Paid
    logs.append("Attempting to add date_manager_paid...")
    run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS date_manager_paid DATE')
    run_sql('ALTER TABLE order ADD COLUMN date_manager_paid DATE')
    
    # 2d. Fixed Bonus and Custom Stage Percentages
    logs.append("Attempting to add fixed_bonus and custom stage percentages...")
    run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS fixed_bonus FLOAT')
    run_sql('ALTER TABLE order ADD COLUMN fixed_bonus REAL')
    
    run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS custom_stage1_percent FLOAT')
    run_sql('ALTER TABLE order ADD COLUMN custom_stage1_percent REAL')
    
    run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS custom_stage2_percent FLOAT')
    run_sql('ALTER TABLE order ADD COLUMN custom_stage2_percent REAL')

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
    
    run_sql('ALTER TABLE payment ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES "user"(id)')
    run_sql('ALTER TABLE payment ADD COLUMN manager_id INTEGER')

    # 4. User Columns (card_number, email)
    logs.append("Checking User table columns...")
    
    # Try multiple variants for the table name
    user_variants = ['"user"', 'public."user"', 'user']
    
    for variant in user_variants:
        try:
            logs.append(f"Trying table name: {variant}")
            # Use distinct run for each column to avoid one failure blocking others
            run_sql(f'ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS card_number VARCHAR')
            run_sql(f'ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS email VARCHAR')
            run_sql(f'ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS phone_number VARCHAR')
            run_sql(f'ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS telegram_id VARCHAR')
            
            # Additional User Columns (v1.5)
            run_sql(f"ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS salary_mode VARCHAR DEFAULT 'sales_percent'")
            run_sql(f"ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS salary_percent FLOAT DEFAULT 5.0")
            run_sql(f"ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS payment_stage1_percent FLOAT DEFAULT 50.0")
            run_sql(f"ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS payment_stage2_percent FLOAT DEFAULT 50.0")
            
            # Manager permissions (v1.6)
            run_sql(f"ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS can_see_constructor_pay BOOLEAN DEFAULT TRUE")
            run_sql(f"ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS can_see_stage1 BOOLEAN DEFAULT TRUE")
            run_sql(f"ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS can_see_stage2 BOOLEAN DEFAULT TRUE")
            run_sql(f"ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS can_see_debt BOOLEAN DEFAULT TRUE")
            run_sql(f"ALTER TABLE {variant} ADD COLUMN IF NOT EXISTS can_see_dashboard BOOLEAN DEFAULT TRUE")
            
            session.commit()
            logs.append(f"COMPLETED checks for {variant}")
            # We don't break anymore because run_sql handles errors individually, 
            # and we want to try other variants if one completely fails (e.g. table not found)
            # but actually if run_sql works, it means table exists.
            # Let's check status of the first run_sql
            break # If we got here without a fatal table error, we are good.
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

    # 5. Order Columns (v1.5)
    logs.append("Checking Order table columns (v1.5)...")
    try:
        # Check for material_cost
        run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS material_cost FLOAT DEFAULT 0.0')
        run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS fixed_bonus FLOAT')
        run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS custom_stage1_percent FLOAT')
        run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS custom_stage2_percent FLOAT')
        
        # Fallback for unquoted
        run_sql('ALTER TABLE order ADD COLUMN material_cost FLOAT DEFAULT 0.0')
        run_sql('ALTER TABLE order ADD COLUMN fixed_bonus FLOAT')
        run_sql('ALTER TABLE order ADD COLUMN custom_stage1_percent FLOAT')
        run_sql('ALTER TABLE order ADD COLUMN custom_stage2_percent FLOAT')
        
        # v1.6 Manager Plan
        run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS date_installation_plan DATE')
        run_sql('ALTER TABLE order ADD COLUMN date_installation_plan DATE')
        run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS constructive_days INTEGER DEFAULT 5')
        run_sql('ALTER TABLE order ADD COLUMN constructive_days INTEGER DEFAULT 5')
        run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS complectation_days INTEGER DEFAULT 2')
        run_sql('ALTER TABLE order ADD COLUMN complectation_days INTEGER DEFAULT 2')
        run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS preassembly_days INTEGER DEFAULT 1')
        run_sql('ALTER TABLE order ADD COLUMN preassembly_days INTEGER DEFAULT 1')
        run_sql('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS installation_days INTEGER DEFAULT 3')
        run_sql('ALTER TABLE order ADD COLUMN installation_days INTEGER DEFAULT 3')
    except:
        pass

    # 6. Create Default Super Admin if missing
    logs.append("Checking for super-admin user...")
    try:
        admin_exists = session.exec(select(User).where(User.username == "admin")).first()
        if not admin_exists:
            from auth import get_password_hash
            default_admin_password = os.environ.get("ADMIN_DEFAULT_PASSWORD", "admin")
            # User is already imported globally
            logs.append("Admin not found. Creating default super-admin...")
            admin_user = User(
                username="admin",
                password_hash=get_password_hash(default_admin_password),
                full_name="Super Administrator",
                role="super_admin"
            )
            session.add(admin_user)
            session.commit()
            logs.append("SUCCESS: Created default super-admin user")
        else:
            if admin_exists.role != "super_admin":
                admin_exists.role = "super_admin"
                session.add(admin_exists)
                session.commit()
                logs.append("SUCCESS: Promoted existing 'admin' user to super_admin.")
            else:
                logs.append("Super-admin already exists.")
    except Exception as e:
        logs.append(f"FAILED to check/create super-admin: {str(e)}")
        session.rollback()

    return {"status": "completed", "logs": logs}

@router.get("/logs", response_model=List[ActivityLogRead])
def get_logs(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    return session.exec(select(ActivityLog).order_by(ActivityLog.timestamp.desc(), ActivityLog.id.desc())).all()

@router.post("/orders/", response_model=OrderRead)
def create_order(order: OrderCreate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    try:
        ensure_order_planning_schema(session)

        # Create DB model from input
        db_order = Order.from_orm(order)
        db_order.constructive_days = max(1, min(60, int(db_order.constructive_days or 5)))
        db_order.complectation_days = max(1, min(60, int(db_order.complectation_days or 2)))
        db_order.preassembly_days = max(1, min(60, int(db_order.preassembly_days or 1)))
        db_order.installation_days = max(1, min(60, int(db_order.installation_days or 3)))
        
        # Logic:
        # - Admin/Manager can assign anyone (via input)
        # - Constructor is forced to assign themselves
        if current_user.role == 'constructor':
            db_order.constructor_id = current_user.id
            db_order.manager_id = None
            db_order.fixed_bonus = None
            db_order.custom_stage1_percent = None
            db_order.custom_stage2_percent = None
            
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

        return OrderRead.from_order(db_order, session)
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
        ensure_order_planning_schema(session)

        query = select(Order)
        
        # FILTER BY ROLE
        # Admin and Manager see ALL orders
        if current_user.role not in MANAGER_ROLES:
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
            
            result.append(OrderRead.from_order(o, session))
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




@router.get("/orders/{order_id}", response_model=OrderRead)
def read_order(
    order_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    ensure_order_planning_schema(session)

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    ensure_order_access(current_user, order)
    return OrderRead.from_order(order, session)


@router.get("/orders/{order_id}/calculation-history", response_model=List[OrderCalculationHistoryItemRead])
def get_order_calculation_history(
    order_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    ensure_order_access(current_user, order)

    constructor = session.get(User, order.constructor_id) if order.constructor_id else None
    manager = session.get(User, order.manager_id) if order.manager_id else None
    base_financials = resolve_constructor_base_financials(order, session=session, constructor=constructor)

    deductions = session.exec(
        select(Deduction)
        .where(Deduction.order_id == order.id)
        .order_by(Deduction.date_created.asc(), Deduction.id.asc())
    ).all()

    allocations = session.exec(
        select(PaymentAllocation)
        .where(PaymentAllocation.order_id == order.id)
        .order_by(PaymentAllocation.created_at.asc(), PaymentAllocation.id.asc())
    ).all()

    payment_ids = list({alloc.payment_id for alloc in allocations})
    payments_by_id = {}
    if payment_ids:
        payments = session.exec(select(Payment).where(Payment.id.in_(payment_ids))).all()
        payments_by_id = {payment.id: payment for payment in payments}

    events = []

    def add_event(event_date, priority, event_type, title, description, amount=0.0, stage=None, extra=None):
        events.append({
            "date": event_date,
            "priority": priority,
            "event_type": event_type,
            "title": title,
            "description": description,
            "amount": amount,
            "stage": stage,
            "extra": extra or {},
        })

    stage1_label = f"Етап I ({base_financials['stage1_percent']:.0f}%)"
    stage2_label = f"Етап II ({base_financials['stage2_percent']:.0f}%)"

    creation_description_parts = [
        f"Ціна замовлення: {order.price:,.2f} грн".replace(",", " "),
        f"ПГ конструктора: {base_financials['bonus']:,.2f} грн".replace(",", " "),
        f"{stage1_label}: {base_financials['raw_advance_amount']:,.2f} грн".replace(",", " "),
        f"{stage2_label}: {base_financials['raw_final_amount']:,.2f} грн".replace(",", " "),
    ]
    if manager and getattr(order, "manager_bonus", None):
        creation_description_parts.append(f"Менеджерська премія: {order.manager_bonus:,.2f} грн".replace(",", " "))

    add_event(
        order.date_received,
        0,
        "created",
        "Сформовано початковий розрахунок",
        " | ".join(creation_description_parts),
        amount=base_financials["bonus"],
    )

    if constructor:
        constructor_name = constructor.full_name or constructor.username
        add_event(
            order.date_received,
            5,
            "constructor_assigned",
            "Замовлення передано конструктору",
            f"Відповідальний конструктор: {constructor_name}. Від цієї точки починається маршрут замовлення.",
            amount=base_financials["bonus"],
        )

    if order.date_to_work:
        add_event(
            order.date_to_work,
            10,
            "stage_started",
            "Конструктор віддав замовлення в роботу",
            f"Активувався {stage1_label}. Після цієї дати борг по першому етапу стає активним.",
            amount=base_financials["raw_advance_amount"],
            stage="advance",
        )

    if order.date_installation:
        add_event(
            order.date_installation,
            20,
            "installation_completed",
            "Монтаж виконано",
            f"Зафіксовано завершення монтажу. Активувався {stage2_label}.",
            amount=base_financials["raw_final_amount"],
            stage="final",
        )

    for deduction in deductions:
        add_event(
            deduction.date_created,
            30,
            "deduction_added",
            "Додано штраф",
            f"{deduction.description}. Штраф зменшує невиплачену суму по замовленню.",
            amount=deduction.amount,
            stage="deduction",
            extra={"deduction_id": deduction.id},
        )
        if deduction.is_paid and deduction.date_paid:
            add_event(
                deduction.date_paid,
                31,
                "deduction_paid",
                "Штраф погашено",
                f"Штраф '{deduction.description}' більше не зменшує борг по замовленню.",
                amount=deduction.amount,
                stage="deduction",
                extra={"deduction_id": deduction.id},
            )

    for allocation in allocations:
        payment = payments_by_id.get(allocation.payment_id)
        allocation_date = payment.date_received if payment else allocation.created_at.date()
        stage_title = "Етап I" if allocation.stage == "advance" else "Етап II"
        distribution_mode = "ручний" if payment and payment.manual_order_id == order.id else "авто"
        notes_text = f" Примітка: {payment.notes}." if payment and payment.notes else ""
        add_event(
            allocation_date,
            40,
            "payment_allocation",
            f"Надійшла виплата на {stage_title}",
            f"Розподілено {allocation.amount:,.2f} грн ({distribution_mode}) на {stage_title.lower()}.{notes_text}".replace(",", " "),
            amount=allocation.amount,
            stage=allocation.stage,
            extra={"payment_id": allocation.payment_id},
        )

    final_snapshot_preview = build_constructor_financial_snapshot(
        raw_advance_amount=base_financials["raw_advance_amount"],
        raw_final_amount=base_financials["raw_final_amount"],
        advance_paid_amount=order.advance_paid_amount or 0.0,
        final_paid_amount=order.final_paid_amount or 0.0,
        unpaid_deductions=sum(d.amount for d in deductions if not d.is_paid),
        stage1_active=bool(order.date_to_work),
        stage2_active=bool(order.date_installation),
    )

    if order.date_installation and final_snapshot_preview["remainder_amount"] <= 0.01:
        add_event(
            order.date_final_paid or order.date_installation,
            90,
            "order_closed",
            "Замовлення закрито",
            "Усі активні етапи закриті, борг відсутній. Замовлення можна вважати завершеним і переносити в архів.",
            amount=0.0,
        )

    events.sort(
        key=lambda event: (
            event["date"] or date.min,
            event["priority"],
            event["extra"].get("payment_id", 0),
            event["extra"].get("deduction_id", 0),
        )
    )

    state = {
        "advance_paid_amount": 0.0,
        "final_paid_amount": 0.0,
        "unpaid_deductions": 0.0,
        "stage1_active": False,
        "stage2_active": False,
    }
    result = []

    for event in events:
        if event["event_type"] == "stage_started":
            if event["stage"] == "advance":
                state["stage1_active"] = True
            elif event["stage"] == "final":
                state["stage2_active"] = True
        elif event["event_type"] == "deduction_added":
            state["unpaid_deductions"] += event["amount"]
        elif event["event_type"] == "deduction_paid":
            state["unpaid_deductions"] = max(0.0, state["unpaid_deductions"] - event["amount"])
        elif event["event_type"] == "payment_allocation":
            if event["stage"] == "advance":
                state["advance_paid_amount"] += event["amount"]
            elif event["stage"] == "final":
                state["final_paid_amount"] += event["amount"]

        snapshot = build_constructor_financial_snapshot(
            raw_advance_amount=base_financials["raw_advance_amount"],
            raw_final_amount=base_financials["raw_final_amount"],
            advance_paid_amount=state["advance_paid_amount"],
            final_paid_amount=state["final_paid_amount"],
            unpaid_deductions=state["unpaid_deductions"],
            stage1_active=state["stage1_active"],
            stage2_active=state["stage2_active"],
        )

        result.append(
            OrderCalculationHistoryItemRead(
                event_date=event["date"],
                event_type=event["event_type"],
                title=event["title"],
                description=event["description"],
                amount=event["amount"],
                stage=event["stage"],
                snapshot={
                    "bonus": base_financials["bonus"],
                    "advance_amount": snapshot["advance_amount"],
                    "final_amount": snapshot["final_amount"],
                    "advance_paid_amount": snapshot["advance_paid_amount"],
                    "final_paid_amount": snapshot["final_paid_amount"],
                    "advance_remaining": snapshot["advance_remaining"],
                    "final_remaining": snapshot["final_remaining"],
                    "current_debt": snapshot["current_debt"],
                    "remainder_amount": snapshot["remainder_amount"],
                    "unpaid_deductions": snapshot["unpaid_deductions"],
                },
            )
        )

    return result

@router.patch("/orders/{order_id}", response_model=OrderRead)
def update_order(
    order_id: int, 
    order_update: OrderUpdate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    ensure_order_planning_schema(session)

    db_order = session.get(Order, order_id)
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    ensure_order_access(current_user, db_order)
    
    # Track if dates changed
    old_date_to_work = db_order.date_to_work
    old_date_installation = db_order.date_installation
    
    order_data = order_update.dict(exclude_unset=True)

    stage_days_fields = ("constructive_days", "complectation_days", "preassembly_days", "installation_days")
    for field in stage_days_fields:
        if field in order_data and order_data[field] is not None:
            try:
                order_data[field] = max(1, min(60, int(order_data[field])))
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail=f"Invalid value for {field}")

    if current_user.role == "constructor":
        restricted_fields = {
            "id",
            "price",
            "material_cost",
            "fixed_bonus",
            "custom_stage1_percent",
            "custom_stage2_percent",
            "constructor_id",
            "manager_id",
            "advance_paid_amount",
            "final_paid_amount",
            "manager_paid_amount",
            "date_advance_paid",
            "date_final_paid",
            "date_manager_paid",
            "constructive_days",
            "complectation_days",
            "preassembly_days",
            "installation_days",
        }
        for field in restricted_fields:
            if field in order_data:
                del order_data[field]
    
    # PERMISSION CHECK:
    # Only Admin/Manager can change constructor_id
    if "constructor_id" in order_data:
        if current_user.role not in MANAGER_ROLES:
            # Silent ignore or error? Let's ignore to prevent frontend crashes if it sends it inadvertently
            del order_data["constructor_id"]
    
    # Check if ID change is requested
    new_id = order_data.get("id")
    if new_id is not None and new_id != order_id:
        if not is_admin(current_user):  # Only admin/super_admin changes IDs
            raise HTTPException(status_code=403, detail="Only Admin can change Order IDs")

        # Check if new ID exists
        existing = session.get(Order, new_id)
        if existing:
            status_text = " (В АРХІВІ)" if (existing.date_advance_paid and existing.date_installation and existing.date_final_paid) else ""
            raise HTTPException(status_code=400, detail=f"ID {new_id} вже зайнятий замовленням '{existing.name}'{status_text}")
        
        # We need to use raw SQL to update PK and cascade to deductions
        from sqlalchemy import text
        session.exec(text("UPDATE deduction SET order_id = :new_id WHERE order_id = :order_id"), {"new_id": new_id, "order_id": order_id}) # deductions first
        session.exec(text("UPDATE order_file SET order_id = :new_id WHERE order_id = :order_id"), {"new_id": new_id, "order_id": order_id}) # files too
        session.exec(text('UPDATE "order" SET id = :new_id WHERE id = :order_id'), {"new_id": new_id, "order_id": order_id}) # Quote table name 'order'
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
    return OrderRead.from_order(db_order, session)

@router.delete("/orders/{order_id}")
def delete_order(
    order_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_admin_user)
):
    db_order = session.get(Order, order_id)
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order_name = db_order.name # Save name for log
    
    # Manually delete orphans just in case
    from sqlalchemy import text
    try:
        session.exec(text("DELETE FROM deduction WHERE order_id = :order_id"), {"order_id": order_id}) # Fines
        session.exec(text("DELETE FROM paymentallocation WHERE order_id = :order_id"), {"order_id": order_id}) # Allocations
        session.exec(text("DELETE FROM orderfile WHERE order_id = :order_id"), {"order_id": order_id}) # Files
        
        # Unlink manual payments (don't delete the money, just unlink order)
        session.exec(text("UPDATE payment SET manual_order_id = NULL WHERE manual_order_id = :order_id"), {"order_id": order_id})
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
def create_payment(
    payment_data: PaymentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_admin_user)
):
    """Додати платіж і автоматично розподілити його"""
    try:
        ensure_payment_schema(session)

        payment = Payment(
            amount=payment_data.amount,
            date_received=payment_data.date_received,
            notes=payment_data.notes,
            allocated_automatically=payment_data.manual_order_id is None,
            manual_order_id=payment_data.manual_order_id,
            constructor_id=payment_data.constructor_id,
            manager_id=payment_data.manager_id
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
def delete_payment(
    payment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_admin_user)
):
    """
    Видалити платіж і ПОВНІСТЮ перерахувати всі розподіли.
    Це необхідно для збереження коректності балансів (First-In-First-Out).
    """
    payment = session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    amount = payment.amount
    date_ = payment.date_received
    
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
            
        # Use fine-adjusted calculation for accurate required amounts
        from payment_service import PaymentDistributionService
        _, advance_required, final_required, _ = PaymentDistributionService._calculate_financials(order, session)
        
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
def get_payments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Отримати історію всіх платежів"""
    payments = session.exec(select(Payment).order_by(Payment.date_received.desc())).all()
    
    result = []
    for p in payments:
        if current_user.role == "constructor" and not is_payment_visible_to_constructor(session, p, current_user.id):
            continue

        p_read = PaymentRead.from_orm(p)
        
        # Resolve person name
        uid = p.constructor_id or p.manager_id
        if uid:
            user = session.get(User, uid)
            if user:
                p_read.person_name = user.full_name or user.username
            else:
                p_read.person_name = "Видалений користувач"
        else:
            p_read.person_name = "Загальний (нерозподілений)"
            
        result.append(p_read)
        
    return result

@router.get("/payments/{payment_id}/allocations")
def get_payment_allocations(
    payment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Отримати розподіл конкретного платежу"""
    payment = session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if current_user.role == "constructor" and not is_payment_visible_to_constructor(session, payment, current_user.id):
        raise HTTPException(status_code=403, detail="Access denied for this payment")

    allocations = session.exec(
        select(PaymentAllocation).where(PaymentAllocation.payment_id == payment_id)
    ).all()
    
    result = []
    for alloc in allocations:
        order = session.get(Order, alloc.order_id)
        result.append({
            "order_id": alloc.order_id,
            "order_name": order.name if order else "Unknown",
            "stage": alloc.stage,
            "amount": alloc.amount
        })
    
    return result

@router.post("/payments/redistribute")
def redistribute_payments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_admin_user)
):
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


def reconcile_order_allocations_after_financial_change(order: Order, session: Session):
    """
    Recalculate payout requirements after changing deductions.

    If the order became overpaid, free the latest allocations for this order.
    Then run a redistribution pass so released money can close other debts or,
    after deleting a deduction, return to this order if unallocated funds exist.
    """
    _, new_advance_needed, new_final_needed, _ = PaymentDistributionService._calculate_financials(order, session)

    advance_overpaid = max(0, order.advance_paid_amount - new_advance_needed)
    final_overpaid = max(0, order.final_paid_amount - new_final_needed)

    if advance_overpaid > 0.01:
        order.advance_paid_amount = new_advance_needed
        if new_advance_needed < 0.01:
            order.date_advance_paid = None

    if final_overpaid > 0.01:
        order.final_paid_amount = new_final_needed
        if new_final_needed < 0.01:
            order.date_final_paid = None

    if advance_overpaid > 0.01 or final_overpaid > 0.01:
        session.add(order)

        total_to_free = advance_overpaid + final_overpaid
        allocations = session.exec(
            select(PaymentAllocation)
            .where(PaymentAllocation.order_id == order.id)
            .order_by(PaymentAllocation.id.desc())
        ).all()

        for alloc in allocations:
            if total_to_free <= 0.01:
                break

            if alloc.amount <= total_to_free:
                total_to_free -= alloc.amount
                session.delete(alloc)
            else:
                alloc.amount -= total_to_free
                session.add(alloc)
                total_to_free = 0

        session.commit()

    PaymentDistributionService.distribute_all_unallocated(session)
    session.refresh(order)

# File Management
# File Link Management
@router.get("/orders/{order_id}/files", response_model=List[OrderFileRead])
def get_order_files(
    order_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    ensure_order_access(current_user, order)
    return session.exec(select(OrderFile).where(OrderFile.order_id == order_id)).all()

@router.post("/orders/{order_id}/files", response_model=OrderFileRead)
def add_file_link(
    order_id: int,
    file_data: OrderFileCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    ensure_order_access(current_user, order)

    try:
        folder_name = normalize_folder_category(file_data.folder_name)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid folder category")
        
    new_file = OrderFile(
        order_id=order_id,
        name=file_data.name,
        url=file_data.url,
        folder_name=folder_name
    )
    session.add(new_file)
    session.commit()
    session.refresh(new_file)
    
    # Log action
    log_activity(session, "ADD_FILE", f"Додано посилання на файл '{new_file.name}' до замовлення '{order.name}'")
    
    return new_file

@router.delete("/files/{file_id}")
def delete_file_link(
    file_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    file_link = session.get(OrderFile, file_id)
    if not file_link:
        raise HTTPException(status_code=404, detail="File link not found")
        
    order = session.get(Order, file_link.order_id)
    if order:
        ensure_order_access(current_user, order)
    order_name = order.name if order else "Unknown"
    file_name = file_link.name
    
    session.delete(file_link)
    session.commit()
    
    # Log action
    log_activity(session, "DELETE_FILE", f"Видалено посилання на файл '{file_name}' із замовлення '{order_name}'")
    
    return {"ok": True}

    


# Deduction endpoints
@router.post("/deductions/")
def create_deduction(
    deduction_data: DeductionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_manager_user)
):
    # Verify order exists
    order = session.get(Order, deduction_data.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    deduction = Deduction(**deduction_data.dict())
    session.add(deduction)
    session.commit()
    session.refresh(deduction)
    
    order = session.get(Order, deduction.order_id)

    try:
        reconcile_order_allocations_after_financial_change(order, session)
    except Exception as e:
        print(f"Warning: recalculation after fine failed: {e}")
    
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
def get_deductions(
    order_id: int = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if order_id:
        order = session.get(Order, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        ensure_order_access(current_user, order)
        deductions = session.exec(
            select(Deduction).where(Deduction.order_id == order_id)
        ).all()
    else:
        if current_user.role in MANAGER_ROLES:
            deductions = session.exec(select(Deduction)).all()
        else:
            own_order_ids = session.exec(
                select(Order.id).where(Order.constructor_id == current_user.id)
            ).all()
            if own_order_ids:
                deductions = session.exec(
                    select(Deduction).where(Deduction.order_id.in_(own_order_ids))
                ).all()
            else:
                deductions = []
    
    result = []
    for ded in deductions:
        order = session.get(Order, ded.order_id)
        result.append(DeductionRead.from_deduction(ded, order.name if order else "Unknown"))
    
    return result

@router.patch("/deductions/{deduction_id}")
def update_deduction(
    deduction_id: int,
    deduction_update: "DeductionUpdate",
    session: Session = Depends(get_session),
    current_user: User = Depends(get_manager_user)
):
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
    if order:
        try:
            reconcile_order_allocations_after_financial_change(order, session)
        except Exception as e:
            print(f"Warning: recalculation after deduction update failed: {e}")
    log_activity(session, "UPDATE_DEDUCTION", f"Оновлено штраф #{deduction_id}")
    return DeductionRead.from_deduction(deduction, order.name if order else "Unknown")

@router.delete("/deductions/{deduction_id}")
def delete_deduction(
    deduction_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_manager_user)
):
    deduction = session.get(Deduction, deduction_id)
    if not deduction:
        raise HTTPException(status_code=404, detail="Deduction not found")
    
    order = session.get(Order, deduction.order_id)
    deduction_amount = deduction.amount # Save for log
    session.delete(deduction)
    session.commit()

    if order:
        try:
            reconcile_order_allocations_after_financial_change(order, session)
        except Exception as e:
            print(f"Warning: recalculation after deduction delete failed: {e}")
    
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
        
        # Per-User Stats
        constructors_stats = []
        manager_stats = []
        
        # Pull all users who could be constructors or managers
        all_users = session.exec(select(User)).all()
        
        # Helper to check activity
        def has_constructor_activity(u_id):
            return session.exec(select(Order).where(Order.constructor_id == u_id)).first() is not None or \
                   session.exec(select(Payment).where(Payment.constructor_id == u_id)).first() is not None

        def has_manager_activity(u_id):
            return session.exec(select(Order).where(Order.manager_id == u_id)).first() is not None or \
                   session.exec(select(Payment).where(Payment.manager_id == u_id)).first() is not None

        constructors = [u for u in all_users if u.role == 'constructor' or has_constructor_activity(u.id)]
        managers = [u for u in all_users if u.role == 'manager' or has_manager_activity(u.id)]
        
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
                order_view = OrderRead.from_order(o, session)
                c_debt += order_view.current_debt

            global_total_debt += c_debt

            constructors_stats.append({
                "id": c.id,
                "name": c.full_name or c.username,
                "unallocated": c_unallocated,
                "debt": c_debt 
            })
        # Global Manager Stats
        total_manager_bonus = 0.0
        total_manager_paid = 0.0
        
        for m in managers:
            m_orders = session.exec(select(Order).where(Order.manager_id == m.id)).all()
            m_bonus_total = 0.0
            m_paid_total = 0.0
            
            for o in m_orders:
                # Logic from OrderRead
                if m and hasattr(m, 'salary_mode') and hasattr(m, 'salary_percent'):
                    if m.salary_mode == 'fixed_amount':
                        ob = m.salary_percent
                    elif m.salary_mode == 'materials_percent':
                        ob = (o.price - (o.material_cost or 0)) * (m.salary_percent / 100)
                    else:
                        ob = o.price * (m.salary_percent / 100)
                else:
                    ob = (o.price - (o.material_cost or 0)) * 0.03
                
                m_bonus_total += ob
                m_paid_total += (o.manager_paid_amount or 0)
            
            m_debt = max(0, m_bonus_total - m_paid_total)
            manager_stats.append({
                "id": m.id,
                "name": m.full_name or m.username,
                "bonus": m_bonus_total,
                "paid": m_paid_total,
                "debt": m_debt
            })
            total_manager_bonus += m_bonus_total
            total_manager_paid += m_paid_total

        return {
            "total_received": total_received,
            "total_allocated": total_allocated,
            "unallocated": unallocated,
            "total_deductions": total_deductions,
            "total_debt": global_total_debt,
            "total_manager_debt": total_manager_bonus - total_manager_paid,
            "constructors_stats": constructors_stats,
            "manager_stats": manager_stats
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
def reset_database(
    request: ResetRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_super_admin_user)
):
    expected_password = os.environ.get("ADMIN_RESET_PASSWORD")
    if not expected_password:
        raise HTTPException(status_code=503, detail="Database reset is disabled")

    if request.password != expected_password:
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
    
    log_activity(session, "SYSTEM_RESET", "Всі дані було очищено суперадміністратором")
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
def restore_database(file: UploadFile = File(...), current_user: User = Depends(get_super_admin_user), session: Session = Depends(get_session)):
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
        
        def parse_date(date_str):
            if not date_str: return None
            try:
                # Handle YYYY-MM-DD
                return datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                # Fallback for full ISO format if present
                try:
                    return datetime.fromisoformat(date_str).date()
                except:
                    return None

        def parse_datetime(dt_str):
            if not dt_str: return None
            try:
                # Handle standard ISO format
                return datetime.fromisoformat(dt_str)
            except:
                return None

        # USERS
        for item in data.get("users", []):
            session.add(User(**item))
        session.flush() # Ensure IDs are claimed
            
        # ORDERS
        for item in data.get("orders", []):
            # Manually parse date fields
            if "date_received" in item: item["date_received"] = parse_date(item["date_received"])
            if "date_design_deadline" in item: item["date_design_deadline"] = parse_date(item["date_design_deadline"])
            if "date_to_work" in item: item["date_to_work"] = parse_date(item["date_to_work"])
            if "date_installation" in item: item["date_installation"] = parse_date(item["date_installation"])
            if "date_advance_paid" in item: item["date_advance_paid"] = parse_date(item["date_advance_paid"])
            if "date_final_paid" in item: item["date_final_paid"] = parse_date(item["date_final_paid"])
            
            session.add(Order(**item))
        session.flush()

        # PAYMENTS
        for item in data.get("payments", []):
            if "date_received" in item: item["date_received"] = parse_date(item["date_received"])
            if "created_at" in item: item["created_at"] = parse_datetime(item["created_at"])
            session.add(Payment(**item))
        session.flush()

        # ALLOCATIONS
        for item in data.get("allocations", []):
            if "created_at" in item: item["created_at"] = parse_datetime(item["created_at"])
            session.add(PaymentAllocation(**item))
        
        # DEDUCTIONS
        for item in data.get("deductions", []):
            if "date_created" in item: item["date_created"] = parse_date(item["date_created"])
            if "date_paid" in item: item["date_paid"] = parse_date(item["date_paid"])
            session.add(Deduction(**item))
            
        # ACTIVITY LOGS
        for item in data.get("activity_logs", []):
            if "timestamp" in item: item["timestamp"] = parse_date(item["timestamp"])
            session.add(ActivityLog(**item))
            
        # FILES
        for item in data.get("order_files", []):
            if "upload_date" in item: item["upload_date"] = parse_date(item["upload_date"])
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
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    ensure_order_access(current_user, order)

    try:
        folder_category = normalize_folder_category(folder_category)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid folder category")
        
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
def download_file(
    order_id: int,
    folder_category: str,
    filename: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    ensure_order_access(current_user, order)

    try:
        folder_category = normalize_folder_category(folder_category)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid folder category")
        
    settings = load_settings()
    safe_filename = sanitize_filename(filename)
    file_path = get_file_path(order.name, folder_category, safe_filename, settings.storage_path)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
        
    return FileResponse(path=file_path, filename=safe_filename)

@router.get("/debug/force_fix")
def debug_force_fix(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_admin_user)
):
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
