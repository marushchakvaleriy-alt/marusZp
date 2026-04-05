from typing import Optional
from datetime import date
from sqlmodel import Field, SQLModel
from pydantic import BaseModel
from financial_logic import calculate_constructor_financials

# User Model
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    full_name: str
    role: str = "constructor"  # 'admin' or 'constructor'
    is_active: bool = True
    card_number: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    telegram_id: Optional[str] = Field(default=None)
    salary_mode: str = Field(default='sales_percent')  # 'sales_percent' or 'materials_percent'
    salary_percent: float = Field(default=5.0)  # Percentage value
    payment_stage1_percent: float = Field(default=50.0)  # % paid after stage 1 (Конструктив)
    payment_stage2_percent: float = Field(default=50.0)  # % paid after stage 2 (Монтаж)
    # Manager permissions (only applicable for role='manager')
    can_see_constructor_pay: bool = Field(default=True)  # Show "Конструкторська робота" column
    can_see_stage1: bool = Field(default=True)  # Show "Етап I: Конструктив" column
    can_see_stage2: bool = Field(default=True)  # Show "Етап II: Монтаж" column
    can_see_debt: bool = Field(default=True)  # Show "Борг/Залишок" column
    can_see_dashboard: bool = Field(default=True)  # Show top dashboards

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "constructor"
    card_number: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    telegram_id: Optional[str] = None
    salary_mode: str = 'sales_percent'
    salary_percent: float = 5.0
    payment_stage1_percent: float = 50.0
    payment_stage2_percent: float = 50.0
    # Manager permissions
    can_see_constructor_pay: bool = True
    can_see_stage1: bool = True
    can_see_stage2: bool = True
    can_see_debt: bool = True
    can_see_dashboard: bool = True

class UserRead(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    is_active: bool
    card_number: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    telegram_id: Optional[str] = None
    salary_mode: Optional[str] = None
    salary_percent: Optional[float] = None
    payment_stage1_percent: Optional[float] = None
    payment_stage2_percent: Optional[float] = None
    # Manager permissions
    can_see_constructor_pay: Optional[bool] = None
    can_see_stage1: Optional[bool] = None
    can_see_stage2: Optional[bool] = None
    can_see_debt: Optional[bool] = None
    can_see_dashboard: Optional[bool] = None

class UserUpdate(BaseModel):
    password: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    card_number: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    telegram_id: Optional[str] = None
    salary_mode: Optional[str] = None
    salary_percent: Optional[float] = None
    payment_stage1_percent: Optional[float] = None
    payment_stage2_percent: Optional[float] = None
    # Manager permissions
    can_see_constructor_pay: Optional[bool] = None
    can_see_stage1: Optional[bool] = None
    can_see_stage2: Optional[bool] = None
    can_see_debt: Optional[bool] = None
    can_see_dashboard: Optional[bool] = None

class OrderBase(SQLModel):
    name: str = Field(index=True)
    price: float = Field(default=0.0)
    material_cost: float = Field(default=0.0)  # Cost of materials
    product_types: Optional[str] = None  # JSON array of product types
    date_received: Optional[date] = None
    date_design_deadline: Optional[date] = None # Deadline for constructor
    date_to_work: Optional[date] = None
    date_advance_paid: Optional[date] = None
    date_installation: Optional[date] = None
    date_final_paid: Optional[date] = None
    advance_paid_amount: float = Field(default=0.0)
    final_paid_amount: float = Field(default=0.0)
    constructor_id: Optional[int] = Field(default=None, foreign_key="user.id") # Link to User
    manager_id: Optional[int] = Field(default=None, foreign_key="user.id") # Link to Manager
    # Fixed salary and custom stage distribution
    fixed_bonus: Optional[float] = Field(default=None)  # Manager override for exact bonus amount
    custom_stage1_percent: Optional[float] = Field(default=None)  # Override stage 1 %
    custom_stage2_percent: Optional[float] = Field(default=None)  # Override stage 2 %
    date_installation_plan: Optional[date] = None  # Manager's planned date (No effect on constructor)
    constructive_days: int = Field(default=5)  # Planned duration of "Конструктив"
    complectation_days: int = Field(default=2)  # Planned duration of "Комплектація"
    preassembly_days: int = Field(default=1)  # Planned duration of "Предзбірка"
    installation_days: int = Field(default=3)  # Planned installation duration in days
    
    # Manager payment tracking
    manager_paid_amount: float = Field(default=0.0)
    date_manager_paid: Optional[date] = None

class Order(OrderBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

# Deduction Model (штрафи/відрахування)
class Deduction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="order.id")
    amount: float
    description: str
    date_created: date
    is_paid: bool = False
    date_paid: Optional[date] = None

class OrderCreate(OrderBase):
    pass

class OrderUpdate(SQLModel):
    name: Optional[str] = None
    price: Optional[float] = None
    material_cost: Optional[float] = None
    product_types: Optional[str] = None
    date_received: Optional[date] = None
    date_design_deadline: Optional[date] = None
    date_to_work: Optional[date] = None
    date_advance_paid: Optional[date] = None
    date_installation: Optional[date] = None
    date_final_paid: Optional[date] = None
    advance_paid_amount: Optional[float] = None
    final_paid_amount: Optional[float] = None
    id: Optional[int] = None # Allow updating ID manually
    constructor_id: Optional[int] = None
    manager_id: Optional[int] = None
    fixed_bonus: Optional[float] = None
    custom_stage1_percent: Optional[float] = None
    custom_stage2_percent: Optional[float] = None
    date_installation_plan: Optional[date] = None  # v1.6 Manager Plan
    constructive_days: Optional[int] = None
    complectation_days: Optional[int] = None
    preassembly_days: Optional[int] = None
    installation_days: Optional[int] = None

class OrderRead(OrderBase):
    id: int
    bonus: float
    advance_amount: float
    advance_remaining: float
    final_amount: float
    final_remaining: float
    remainder_amount: float
    current_debt: float = 0.0
    is_critical_debt: bool
    status_payment: str
    constructor_id: Optional[int] = None
    manager_id: Optional[int] = None
    manager_bonus: float = 0.0
    manager_paid_amount: float = 0.0
    manager_remaining: float = 0.0

    @classmethod
    def from_order(cls, order: Order, session_or_constructor=None):
        constructor = None
        manager = None
        session = None
        # Accept either a session or a constructor for backwards compatibility
        from sqlmodel import Session
        if isinstance(session_or_constructor, Session):
            session = session_or_constructor
            if order.constructor_id:
                from models import User
                constructor = session.get(User, order.constructor_id)
            if order.manager_id:
                from models import User
                manager = session.get(User, order.manager_id)
        else:
            constructor = session_or_constructor

        constructor_financials = calculate_constructor_financials(
            order,
            session=session,
            constructor=constructor,
        )
        bonus = constructor_financials["bonus"]

        # 1b. Determine manager bonus amount
        manager_bonus = 0.0
        if manager and hasattr(manager, 'salary_mode') and hasattr(manager, 'salary_percent'):
            if manager.salary_mode == 'fixed_amount':
                manager_bonus = manager.salary_percent
            elif manager.salary_mode == 'materials_percent':
                manager_bonus = (order.material_cost or 0) * (manager.salary_percent / 100)
            else:
                manager_bonus = order.price * (manager.salary_percent / 100)
        
        manager_remaining = max(0, manager_bonus - (order.manager_paid_amount or 0))

        advance_amount = constructor_financials["advance_amount"]
        final_amount = constructor_financials["final_amount"]
        advance_remaining = constructor_financials["advance_remaining"]
        final_remaining = constructor_financials["final_remaining"]
        
        # Auto-set payment dates if fully paid
        date_advance_paid = order.date_advance_paid
        if advance_remaining == 0 and order.advance_paid_amount > 0 and not date_advance_paid:
            date_advance_paid = order.date_to_work  # Will be set by payment service
            
        date_final_paid = order.date_final_paid
        if final_remaining == 0 and order.final_paid_amount > 0 and not date_final_paid:
            date_final_paid = order.date_installation
        
        if order.date_final_paid:
            status = "paid"
        elif order.date_advance_paid or order.advance_paid_amount > 0:
            status = "partially_paid"
        elif order.date_to_work:
            status = "in_progress"
        else:
            status = "new"

        return cls(
            id=order.id,
            name=order.name,
            price=order.price,
            material_cost=order.material_cost,
            product_types=order.product_types,
            date_received=order.date_received,
            date_design_deadline=order.date_design_deadline,
            date_to_work=order.date_to_work,
            date_advance_paid=date_advance_paid or order.date_advance_paid,
            date_installation=order.date_installation,
            date_installation_plan=order.date_installation_plan,
            date_final_paid=date_final_paid or order.date_final_paid,
            advance_paid_amount=order.advance_paid_amount,
            final_paid_amount=order.final_paid_amount,
            fixed_bonus=order.fixed_bonus,
            custom_stage1_percent=order.custom_stage1_percent,
            custom_stage2_percent=order.custom_stage2_percent,
            constructive_days=order.constructive_days or 5,
            complectation_days=order.complectation_days or 2,
            preassembly_days=order.preassembly_days or 1,
            installation_days=order.installation_days or 3,
            bonus=bonus,
            advance_amount=advance_amount,
            advance_remaining=advance_remaining,
            final_amount=final_amount,
            final_remaining=final_remaining,
            remainder_amount=advance_remaining + final_remaining,
            is_critical_debt=(
                (order.date_to_work is not None and advance_remaining > 0.01) or
                (order.date_installation is not None and final_remaining > 0.01)
            ),
            status_payment=status,
            constructor_id=order.constructor_id,
            manager_id=order.manager_id,
            manager_bonus=manager_bonus,
            manager_paid_amount=order.manager_paid_amount,
            manager_remaining=manager_remaining
        )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Calculate current_debt: sum of remaining amounts for ACTIVE but UNPAID stages
        current_debt = 0.0
        # If work started but advance not fully paid
        if self.date_to_work and (self.advance_remaining > 0.01):
             current_debt += self.advance_remaining
        # If installation done but final not fully paid
        if self.date_installation and (self.final_remaining > 0.01):
             current_debt += self.final_remaining
             
        object.__setattr__(self, 'current_debt', current_debt)

# Deduction Pydantic Models
class DeductionCreate(BaseModel):
    order_id: int
    amount: float
    description: str
    date_created: date

class DeductionRead(BaseModel):
    id: int
    order_id: int
    order_name: str  # For display
    amount: float
    description: str
    date_created: date
    is_paid: bool
    date_paid: Optional[date] = None

    @classmethod
    def from_deduction(cls, deduction: Deduction, order_name: str):
        return cls(
            id=deduction.id,
            order_id=deduction.order_id,
            order_name=order_name,
            amount=deduction.amount,
            description=deduction.description,
            date_created=deduction.date_created,
            is_paid=deduction.is_paid,
            date_paid=deduction.date_paid
        )

class DeductionUpdate(BaseModel):
    is_paid: Optional[bool] = None
    date_paid: Optional[date] = None


class OrderCalculationSnapshotRead(BaseModel):
    bonus: float
    advance_amount: float
    final_amount: float
    advance_paid_amount: float
    final_paid_amount: float
    advance_remaining: float
    final_remaining: float
    current_debt: float
    remainder_amount: float
    unpaid_deductions: float


class OrderCalculationHistoryItemRead(BaseModel):
    event_date: Optional[date] = None
    event_type: str
    title: str
    description: str
    amount: float = 0.0
    stage: Optional[str] = None
    snapshot: OrderCalculationSnapshotRead

# Activity Log Model
class ActivityLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: date = Field(default_factory=date.today) # Use datetime if time is needed, but for now date is consistent with other models
    action_type: str  # e.g., "CREATE", "DELETE", "UPDATE", "PAYMENT"
    description: str
    details: Optional[str] = None # JSON string for extra details if needed

class ActivityLogRead(BaseModel):
    id: int
    timestamp: date
    action_type: str
    description: str
    details: Optional[str] = None

# Order File Model (Links to external storage like Google Drive)
class OrderFile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="order.id")
    name: str
    url: str
    folder_name: str
    upload_date: date = Field(default_factory=date.today)

class OrderFileCreate(BaseModel):
    name: str
    url: str
    folder_name: str

class OrderFileRead(BaseModel):
    id: int
    order_id: int
    name: str
    url: str
    folder_name: str
    upload_date: date
