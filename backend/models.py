from typing import Optional
from datetime import date
from sqlmodel import Field, SQLModel
from pydantic import BaseModel

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
    # Fixed salary and custom stage distribution
    fixed_bonus: Optional[float] = Field(default=None)  # Manager override for exact bonus amount
    custom_stage1_percent: Optional[float] = Field(default=None)  # Override stage 1 %
    custom_stage2_percent: Optional[float] = Field(default=None)  # Override stage 2 %

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
    fixed_bonus: Optional[float] = None
    custom_stage1_percent: Optional[float] = None
    custom_stage2_percent: Optional[float] = None

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

    @classmethod
    def from_order(cls, order: Order, constructor=None):
        # 1. Determine bonus amount
        if order.fixed_bonus is not None:
            # Manager override: use exact fixed amount
            bonus = order.fixed_bonus
        elif constructor and hasattr(constructor, 'salary_mode') and hasattr(constructor, 'salary_percent'):
            # Calculate based on constructor's salary configuration
            if constructor.salary_mode == 'fixed_amount':
                # Fixed amount per order (salary_percent stores the fixed amount)
                bonus = constructor.salary_percent
            elif constructor.salary_mode == 'materials_percent':
                # Calculate from material cost
                bonus = (order.material_cost or 0) * (constructor.salary_percent / 100)
            else:
                # Default: calculate from sales price (sales_percent)
                bonus = order.price * (constructor.salary_percent / 100)
        else:
            # Fallback to old logic (5% of sales price)
            bonus = order.price * 0.05
        
        # 2. Determine stage distribution percentages
        if order.custom_stage1_percent is not None:
            # Per-order override
            stage1_pct = order.custom_stage1_percent
            stage2_pct = order.custom_stage2_percent if order.custom_stage2_percent is not None else (100 - stage1_pct)
            print(f"🔧 Order {order.id} using CUSTOM stages: {stage1_pct}/{stage2_pct}")
        elif constructor and hasattr(constructor, 'payment_stage1_percent'):
            # Use constructor's default stage distribution
            stage1_pct = constructor.payment_stage1_percent
            stage2_pct = constructor.payment_stage2_percent
            print(f"👤 Order {order.id} using constructor '{constructor.full_name}' stages: {stage1_pct}/{stage2_pct}")
        else:
            # Fallback: 50/50
            stage1_pct = 50.0
            stage2_pct = 50.0
            print(f"⚠️ Order {order.id} using FALLBACK stages: {stage1_pct}/{stage2_pct}")
        
        # 3. Calculate stage amounts
        advance_amount = bonus * (stage1_pct / 100)
        final_amount = bonus * (stage2_pct / 100)
        
        advance_remaining = max(0, advance_amount - order.advance_paid_amount)
        final_remaining = max(0, final_amount - order.final_paid_amount)
        
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
            product_types=order.product_types,
            date_received=order.date_received,
            date_to_work=order.date_to_work,
            date_advance_paid=date_advance_paid or order.date_advance_paid,
            date_installation=order.date_installation,
            date_final_paid=date_final_paid or order.date_final_paid,
            advance_paid_amount=order.advance_paid_amount,
            final_paid_amount=order.final_paid_amount,
            bonus=bonus,
            advance_amount=advance_amount,
            advance_remaining=advance_remaining,
            final_amount=final_amount,
            final_remaining=final_remaining,
            remainder_amount=advance_remaining + final_remaining,
            is_critical_debt=(
                # Work started but advance not paid = DEBT
                (order.date_to_work is not None and (date_advance_paid is None and order.date_advance_paid is None)) or
                # Installation done but final payment not paid = DEBT
                (order.date_installation is not None and (date_final_paid is None and order.date_final_paid is None))
            ),
            status_payment=status,
            constructor_id=order.constructor_id,
            date_design_deadline=order.date_design_deadline
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
