from typing import Any, Dict, Optional

from sqlmodel import Session
from sqlalchemy import text


def _sum_unpaid_deductions_for_target(
    session: Optional[Session],
    order_id: Optional[int],
    target_role: str,
) -> float:
    if not session or order_id is None:
        return 0.0

    params = {"order_id": order_id}

    try:
        if target_role == "manager":
            total = session.execute(
                text(
                    "SELECT COALESCE(SUM(amount), 0) "
                    "FROM deduction "
                    "WHERE order_id = :order_id AND is_paid = FALSE AND target_role = 'manager'"
                ),
                params,
            ).scalar()
        else:
            # Legacy compatibility: old rows without target_role are treated as constructor fines.
            total = session.execute(
                text(
                    "SELECT COALESCE(SUM(amount), 0) "
                    "FROM deduction "
                    "WHERE order_id = :order_id AND is_paid = FALSE "
                    "AND (target_role = 'constructor' OR target_role IS NULL)"
                ),
                params,
            ).scalar()
        return float(total or 0.0)
    except Exception:
        # Column target_role might not exist in very old DB snapshots.
        try:
            if target_role == "manager":
                return 0.0
            total_legacy = session.execute(
                text(
                    "SELECT COALESCE(SUM(amount), 0) "
                    "FROM deduction "
                    "WHERE order_id = :order_id AND is_paid = FALSE"
                ),
                params,
            ).scalar()
            return float(total_legacy or 0.0)
        except Exception:
            return 0.0


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


def resolve_manager_base_financials(
    order: Any,
    session: Optional[Session] = None,
    manager: Any = None,
) -> Dict[str, float]:
    if manager is None and session and getattr(order, "manager_id", None):
        from models import User

        manager = session.get(User, order.manager_id)

    if manager and hasattr(manager, "salary_mode") and hasattr(manager, "salary_percent"):
        if manager.salary_mode == "fixed_amount":
            bonus = manager.salary_percent
        elif manager.salary_mode == "materials_percent":
            bonus = (order.material_cost or 0) * (manager.salary_percent / 100)
        else:
            bonus = order.price * (manager.salary_percent / 100)
    else:
        bonus = 0.0

    if manager and hasattr(manager, "payment_stage1_percent"):
        stage1_percent = manager.payment_stage1_percent if manager.payment_stage1_percent is not None else 50.0
        if getattr(manager, "payment_stage2_percent", None) is not None:
            stage2_percent = manager.payment_stage2_percent
        else:
            stage2_percent = 100.0 - stage1_percent
    else:
        stage1_percent = 50.0
        stage2_percent = 50.0

    raw_stage1_amount = bonus * (stage1_percent / 100)
    raw_stage2_amount = bonus * (stage2_percent / 100)

    return {
        "bonus": bonus,
        "stage1_percent": stage1_percent,
        "stage2_percent": stage2_percent,
        "raw_stage1_amount": raw_stage1_amount,
        "raw_stage2_amount": raw_stage2_amount,
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


def build_manager_financial_snapshot(
    raw_stage1_amount: float,
    raw_stage2_amount: float,
    paid_amount: float = 0.0,
    unpaid_deductions: float = 0.0,
    stage1_active: bool = False,
    stage2_active: bool = False,
) -> Dict[str, float]:
    paid_amount = paid_amount or 0.0
    stage1_amount = max(0.0, raw_stage1_amount or 0.0)
    stage2_amount = max(0.0, raw_stage2_amount or 0.0)
    fine_remaining = max(0.0, unpaid_deductions or 0.0)

    # Split paid amount by initial stage map before deductions.
    stage1_paid_raw = min(paid_amount, stage1_amount)
    stage2_paid_raw = min(max(0.0, paid_amount - stage1_amount), stage2_amount)

    # Apply deductions to unpaid balances first, then to already covered balances (latest stage first).
    unpaid_stage1_balance = max(0.0, stage1_amount - stage1_paid_raw)
    deduct_stage1_unpaid = min(fine_remaining, unpaid_stage1_balance)
    stage1_amount -= deduct_stage1_unpaid
    fine_remaining -= deduct_stage1_unpaid

    unpaid_stage2_balance = max(0.0, stage2_amount - stage2_paid_raw)
    deduct_stage2_unpaid = min(fine_remaining, unpaid_stage2_balance)
    stage2_amount -= deduct_stage2_unpaid
    fine_remaining -= deduct_stage2_unpaid

    deduct_stage2_paid = min(fine_remaining, stage2_amount)
    stage2_amount -= deduct_stage2_paid
    fine_remaining -= deduct_stage2_paid

    deduct_stage1_paid = min(fine_remaining, stage1_amount)
    stage1_amount -= deduct_stage1_paid
    fine_remaining -= deduct_stage1_paid

    stage1_amount = max(0.0, stage1_amount)
    stage2_amount = max(0.0, stage2_amount)
    total_bonus = stage1_amount + stage2_amount

    # Re-map paid amount against adjusted stage amounts.
    stage1_paid_amount = min(paid_amount, stage1_amount)
    stage2_paid_amount = min(max(0.0, paid_amount - stage1_amount), stage2_amount)

    stage1_remaining = max(0.0, stage1_amount - stage1_paid_amount)
    stage2_remaining = max(0.0, stage2_amount - stage2_paid_amount)

    active_amount = 0.0
    if stage1_active:
        active_amount += stage1_amount
    if stage2_active:
        active_amount += stage2_amount

    active_paid_amount = min(paid_amount, active_amount)
    current_debt = 0.0
    if stage1_active:
        current_debt += stage1_remaining
    if stage2_active:
        current_debt += stage2_remaining

    return {
        "paid_amount": paid_amount,
        "stage1_paid_amount": stage1_paid_amount,
        "stage2_paid_amount": stage2_paid_amount,
        "stage1_remaining": stage1_remaining,
        "stage2_remaining": stage2_remaining,
        "active_amount": active_amount,
        "active_paid_amount": active_paid_amount,
        "current_debt": current_debt,
        "total_bonus": total_bonus,
        "total_remaining": max(0.0, total_bonus - paid_amount),
        "unpaid_deductions": unpaid_deductions,
    }


def calculate_constructor_financials(
    order: Any,
    session: Optional[Session] = None,
    constructor: Any = None,
) -> Dict[str, float]:
    base_financials = resolve_constructor_base_financials(order, session=session, constructor=constructor)

    unpaid_deductions = _sum_unpaid_deductions_for_target(
        session=session,
        order_id=getattr(order, "id", None),
        target_role="constructor",
    )

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


def calculate_manager_financials(
    order: Any,
    session: Optional[Session] = None,
    manager: Any = None,
) -> Dict[str, float]:
    base_financials = resolve_manager_base_financials(order, session=session, manager=manager)
    unpaid_deductions = _sum_unpaid_deductions_for_target(
        session=session,
        order_id=getattr(order, "id", None),
        target_role="manager",
    )
    snapshot = build_manager_financial_snapshot(
        raw_stage1_amount=base_financials["raw_stage1_amount"],
        raw_stage2_amount=base_financials["raw_stage2_amount"],
        paid_amount=getattr(order, "manager_paid_amount", 0.0) or 0.0,
        unpaid_deductions=unpaid_deductions,
        stage1_active=bool(getattr(order, "date_manager_handover", None)),
        stage2_active=bool(getattr(order, "date_installation", None)),
    )

    return {
        **base_financials,
        **snapshot,
    }
