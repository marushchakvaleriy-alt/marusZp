from typing import Optional
from datetime import date
from sqlmodel import Field, SQLModel
from pydantic import BaseModel

class OrderBase(SQLModel):
    name: str = Field(index=True)
    price: float = Field(default=0.0)
    product_types: Optional[str] = None  # JSON array of product types
    date_received: Optional[date] = None
    date_to_work: Optional[date] = None
    date_advance_paid: Optional[date] = None
    date_installation: Optional[date] = None
    date_final_paid: Optional[date] = None
    advance_paid_amount: float = Field(default=0.0)
    final_paid_amount: float = Field(default=0.0)

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
    product_types: Optional[str] = None
    date_received: Optional[date] = None
    date_to_work: Optional[date] = None
    date_advance_paid: Optional[date] = None
    date_installation: Optional[date] = None
    date_final_paid: Optional[date] = None
    advance_paid_amount: Optional[float] = None
    final_paid_amount: Optional[float] = None

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

    @classmethod
    def from_order(cls, order: Order):
        bonus = order.price * 0.05
        advance_amount = bonus * 0.5
        final_amount = bonus * 0.5
        
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
            status_payment=status
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
