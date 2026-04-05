from typing import Any, Dict, Optional

from sqlmodel import Session, select


def resolve_constructor_base_financials(
    order: Any,
    session: Optional[Session] = None,
    constructor: Any = None,
) -> Dict[str, float]:
    if constructor is None and session and getattr(order, "constructor_id", None):
        from models import User

        constructor = session.get(User, order.constructor_id)

    if order.fixed_bonus is not None:
        bonus = order.fixed_bonus
    elif constructor and hasattr(constructor, "salary_mode") and hasattr(constructor, "salary_percent"):
        if constructor.salary_mode == "fixed_amount":
            bonus = constructor.salary_percent
        elif constructor.salary_mode == "materials_percent":
            bonus = (order.material_cost or 0) * (constructor.salary_percent / 100)
        else:
            bonus = order.price * (constructor.salary_percent / 100)
    else:
        bonus = order.price * 0.05

    if order.custom_stage1_percent is not None:
        stage1_percent = order.custom_stage1_percent
        stage2_percent = order.custom_stage2_percent if order.custom_stage2_percent is not None else (100 - stage1_percent)
    elif constructor and hasattr(constructor, "payment_stage1_percent"):
        stage1_percent = constructor.payment_stage1_percent
        stage2_percent = constructor.payment_stage2_percent
    else:
        stage1_percent = 50.0
        stage2_percent = 50.0

    raw_advance_amount = bonus * (stage1_percent / 100)
    raw_final_amount = bonus * (stage2_percent / 100)

    return {
        "bonus": bonus,
        "stage1_percent": stage1_percent,
        "stage2_percent": stage2_percent,
        "raw_advance_amount": raw_advance_amount,
        "raw_final_amount": raw_final_amount,
    }


def build_constructor_financial_snapshot(
    raw_advance_amount: float,
    raw_final_amount: float,
    advance_paid_amount: float = 0.0,
    final_paid_amount: float = 0.0,
    unpaid_deductions: float = 0.0,
    stage1_active: bool = False,
    stage2_active: bool = False,
) -> Dict[str, float]:
    """
    Centralized constructor payout logic snapshot.

    Policy for unpaid deductions:
    1. Reduce the still-unpaid part of stage 1 first.
    2. Then reduce the still-unpaid part of stage 2.
    3. Only if both unpaid parts are exhausted, reduce already-paid amounts
       starting from stage 2 and then stage 1 (this creates overpayment that
       can be re-freed by redistribution logic).
    """
    advance_amount = raw_advance_amount
    final_amount = raw_final_amount
    fine_remaining = unpaid_deductions

    # First reduce the unpaid current/earlier stage.
    unpaid_advance_balance = max(0.0, advance_amount - advance_paid_amount)
    deduct_from_advance_unpaid = min(fine_remaining, unpaid_advance_balance)
    advance_amount -= deduct_from_advance_unpaid
    fine_remaining -= deduct_from_advance_unpaid

    # Then reduce the unpaid later stage.
    unpaid_final_balance = max(0.0, final_amount - final_paid_amount)
    deduct_from_final_unpaid = min(fine_remaining, unpaid_final_balance)
    final_amount -= deduct_from_final_unpaid
    fine_remaining -= deduct_from_final_unpaid

    # If both stages are already covered, claw back from the latest stage first.
    deduct_from_final_paid = min(fine_remaining, final_amount)
    final_amount -= deduct_from_final_paid
    fine_remaining -= deduct_from_final_paid

    deduct_from_advance_paid = min(fine_remaining, advance_amount)
    advance_amount -= deduct_from_advance_paid
    fine_remaining -= deduct_from_advance_paid

    advance_amount = max(0.0, advance_amount)
    final_amount = max(0.0, final_amount)

    advance_remaining = max(0.0, advance_amount - advance_paid_amount)
    final_remaining = max(0.0, final_amount - final_paid_amount)
    current_debt = 0.0
    if stage1_active:
        current_debt += advance_remaining
    if stage2_active:
        current_debt += final_remaining

    return {
        "advance_amount": advance_amount,
        "final_amount": final_amount,
        "advance_paid_amount": advance_paid_amount,
        "final_paid_amount": final_paid_amount,
        "advance_remaining": advance_remaining,
        "final_remaining": final_remaining,
        "current_debt": current_debt,
        "remainder_amount": advance_remaining + final_remaining,
        "unpaid_deductions": unpaid_deductions,
    }


def calculate_constructor_financials(
    order: Any,
    session: Optional[Session] = None,
    constructor: Any = None,
) -> Dict[str, float]:
    base_financials = resolve_constructor_base_financials(order, session=session, constructor=constructor)

    unpaid_deductions = 0.0
    if session and getattr(order, "id", None) is not None:
        from models import Deduction

        deductions = session.exec(
            select(Deduction)
            .where(Deduction.order_id == order.id)
            .where(Deduction.is_paid == False)
        ).all()
        unpaid_deductions = sum(d.amount for d in deductions)

    advance_paid_amount = getattr(order, "advance_paid_amount", 0.0) or 0.0
    final_paid_amount = getattr(order, "final_paid_amount", 0.0) or 0.0

    snapshot = build_constructor_financial_snapshot(
        raw_advance_amount=base_financials["raw_advance_amount"],
        raw_final_amount=base_financials["raw_final_amount"],
        advance_paid_amount=advance_paid_amount,
        final_paid_amount=final_paid_amount,
        unpaid_deductions=unpaid_deductions,
        stage1_active=bool(getattr(order, "date_to_work", None)),
        stage2_active=bool(getattr(order, "date_installation", None)),
    )

    return {
        **base_financials,
        **snapshot,
    }
