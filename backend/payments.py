from typing import Optional
from datetime import datetime, date
from sqlmodel import Field, SQLModel, Relationship

class Payment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    amount: float = Field(default=0.0)
    date_received: date
    created_at: datetime = Field(default_factory=datetime.utcnow)
    allocated_automatically: bool = Field(default=True)
    notes: Optional[str] = None

class PaymentAllocation(SQLModel, table=True):
    """Зв'язок платежу з конкретним замовленням і етапом"""
    id: Optional[int] = Field(default=None, primary_key=True)
    payment_id: int = Field(foreign_key="payment.id")
    order_id: int = Field(foreign_key="order.id")
    stage: str = Field(default="advance")  # "advance" або "final"
    amount: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PaymentRead(SQLModel):
    id: int
    amount: float
    date_received: date
    created_at: datetime
    allocated_automatically: bool
    notes: Optional[str] = None
