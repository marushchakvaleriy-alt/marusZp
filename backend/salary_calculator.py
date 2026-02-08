"""
SALARY CALCULATION MODULE
=========================

This module contains ALL salary calculation logic in one place.
Any changes to how bonuses are calculated should be made HERE.

Author: Salary Management System
"""

from typing import Optional, Tuple


def calculate_bonus(
    order_price: float,
    material_cost: Optional[float],
    fixed_bonus: Optional[float],
    constructor_salary_mode: str,
    constructor_salary_percent: float
) -> float:
    """
    Calculate total bonus amount for a constructor.
    
    Priority:
    1. fixed_bonus (manager override) - if set, use this exact amount
    2. constructor settings (salary_mode + salary_percent)
    3. fallback: 5% of order price
    
    Args:
        order_price: Total price of the order (what customer pays)
        material_cost: Cost of materials used (can be None)
        fixed_bonus: Manager-set fixed amount (overrides everything)
        constructor_salary_mode: 'sales_percent' | 'materials_percent' | 'fixed_amount'
        constructor_salary_percent: Percentage or fixed amount value
    
    Returns:
        Total bonus amount in UAH
    
    Examples:
        >>> # Example 1: Order 100,000 UAH, constructor gets 10% of sales
        >>> calculate_bonus(100000, None, None, 'sales_percent', 10.0)
        10000.0
        
        >>> # Example 2: Manager override - fixed 15,000 UAH
        >>> calculate_bonus(100000, None, 15000, 'sales_percent', 10.0)
        15000.0
        
        >>> # Example 3: 10% of materials (50,000 UAH)
        >>> calculate_bonus(100000, 50000, None, 'materials_percent', 10.0)
        5000.0
        
        >>> # Example 4: Fixed amount mode (1500 per order)
        >>> calculate_bonus(100000, None, None, 'fixed_amount', 1500)
        1500.0
    """
    # 1. Manager override - highest priority
    if fixed_bonus is not None:
        return fixed_bonus
    
    # 2. Constructor salary configuration
    if constructor_salary_mode == 'fixed_amount':
        # Fixed amount per order (salary_percent stores the amount)
        return constructor_salary_percent
    
    elif constructor_salary_mode == 'materials_percent':
        # Percentage of material cost
        return (material_cost or 0) * (constructor_salary_percent / 100)
    
    elif constructor_salary_mode == 'sales_percent':
        # Percentage of sales price (default)
        return order_price * (constructor_salary_percent / 100)
    
    # 3. Fallback (should never reach here if data is valid)
    return order_price * 0.05


def calculate_stage_distribution(
    total_bonus: float,
    order_custom_stage1_percent: Optional[float],
    order_custom_stage2_percent: Optional[float],
    constructor_stage1_percent: Optional[float],
    constructor_stage2_percent: Optional[float]
) -> Tuple[float, float]:
    """
    Calculate how bonus is split between Stage I (Design) and Stage II (Installation).
    
    Priority:
    1. Per-order custom percentages
    2. Constructor default percentages
    3. Fallback: 50/50
    
    Args:
        total_bonus: Total bonus amount to split
        order_custom_stage1_percent: Order-specific Stage I % (overrides constructor)
        order_custom_stage2_percent: Order-specific Stage II %
        constructor_stage1_percent: Constructor's default Stage I %
        constructor_stage2_percent: Constructor's default Stage II %
    
    Returns:
        (stage1_amount, stage2_amount) tuple in UAH
    
    Examples:
        >>> # Example 1: Default 50/50 split, bonus 10,000 UAH
        >>> calculate_stage_distribution(10000, None, None, None, None)
        (5000.0, 5000.0)
        
        >>> # Example 2: Constructor prefers 60/40, bonus 10,000 UAH
        >>> calculate_stage_distribution(10000, None, None, 60.0, 40.0)
        (6000.0, 4000.0)
        
        >>> # Example 3: Order override 100/0 (all after design)
        >>> calculate_stage_distribution(10000, 100.0, 0.0, 60.0, 40.0)
        (10000.0, 0.0)
        
        >>> # Example 4: Order override 0/100 (all after installation)
        >>> calculate_stage_distribution(10000, 0.0, 100.0, 60.0, 40.0)
        (0.0, 10000.0)
    """
    # 1. Per-order override - highest priority
    if order_custom_stage1_percent is not None:
        stage1_pct = order_custom_stage1_percent
        stage2_pct = order_custom_stage2_percent if order_custom_stage2_percent is not None else (100 - stage1_pct)
    
    # 2. Constructor's default distribution
    elif constructor_stage1_percent is not None:
        stage1_pct = constructor_stage1_percent
        stage2_pct = constructor_stage2_percent if constructor_stage2_percent is not None else 50.0
    
    # 3. Fallback: 50/50
    else:
        stage1_pct = 50.0
        stage2_pct = 50.0
    
    stage1_amount = total_bonus * (stage1_pct / 100)
    stage2_amount = total_bonus * (stage2_pct / 100)
    
    return (stage1_amount, stage2_amount)


def calculate_order_debt(
    stage1_amount: float,
    stage2_amount: float,
    stage1_paid: float,
    stage2_paid: float,
    order_date_to_work: Optional[str],
    order_date_installation: Optional[str]
) -> float:
    """
    Calculate current debt for an order (how much we owe constructor).
    
    Rules:
    - Stage I becomes payable when order goes "To Work" (date_to_work set)
    - Stage II becomes payable when order goes "Installation" (date_installation set)
    - Only count unpaid portions of payable stages
    
    Args:
        stage1_amount: Total Stage I amount
        stage2_amount: Total Stage II amount
        stage1_paid: Amount already paid for Stage I
        stage2_paid: Amount already paid for Stage II
        order_date_to_work: Date when order started (triggers Stage I)
        order_date_installation: Date when installation started (triggers Stage II)
    
    Returns:
        Current debt amount in UAH
    
    Examples:
        >>> # Example 1: Order not started yet - no debt
        >>> calculate_order_debt(5000, 5000, 0, 0, None, None)
        0.0
        
        >>> # Example 2: Order started, Stage I unpaid
        >>> calculate_order_debt(5000, 5000, 0, 0, '2024-01-01', None)
        5000.0
        
        >>> # Example 3: Stage I partially paid (2000/5000)
        >>> calculate_order_debt(5000, 5000, 2000, 0, '2024-01-01', None)
        3000.0
        
        >>> # Example 4: Both stages triggered, Stage I fully paid, Stage II unpaid
        >>> calculate_order_debt(5000, 5000, 5000, 0, '2024-01-01', '2024-02-01')
        5000.0
        
        >>> # Example 5: Both stages fully paid
        >>> calculate_order_debt(5000, 5000, 5000, 5000, '2024-01-01', '2024-02-01')
        0.0
    """
    debt = 0.0
    
    # Stage I debt (only if order started)
    if order_date_to_work:
        stage1_remaining = max(0, stage1_amount - stage1_paid)
        if stage1_remaining > 0.01:  # Ignore pennies
            debt += stage1_remaining
    
    # Stage II debt (only if installation started)
    if order_date_installation:
        stage2_remaining = max(0, stage2_amount - stage2_paid)
        if stage2_remaining > 0.01:  # Ignore pennies
            debt += stage2_remaining
    
    return debt


# =============================================================================
# CONVENIENCE FUNCTION - Calculate everything for an order
# =============================================================================

def calculate_order_financials(
    order_price: float,
    material_cost: Optional[float],
    order_fixed_bonus: Optional[float],
    order_custom_stage1_percent: Optional[float],
    order_custom_stage2_percent: Optional[float],
    order_date_to_work: Optional[str],
    order_date_installation: Optional[str],
    stage1_paid: float,
    stage2_paid: float,
    constructor_salary_mode: str = 'sales_percent',
    constructor_salary_percent: float = 5.0,
    constructor_stage1_percent: Optional[float] = None,
    constructor_stage2_percent: Optional[float] = None
) -> dict:
    """
    Calculate all financial values for an order in one go.
    
    Returns dict with:
        - bonus: total bonus amount
        - stage1_amount: Stage I payment amount
        - stage2_amount: Stage II payment amount
        - stage1_remaining: unpaid Stage I
        - stage2_remaining: unpaid Stage II
        - current_debt: total current debt (what we owe)
    
    Example:
        >>> result = calculate_order_financials(
        ...     order_price=100000,
        ...     material_cost=None,
        ...     order_fixed_bonus=None,
        ...     order_custom_stage1_percent=None,
        ...     order_custom_stage2_percent=None,
        ...     order_date_to_work='2024-01-01',
        ...     order_date_installation=None,
        ...     stage1_paid=0,
        ...     stage2_paid=0,
        ...     constructor_salary_mode='sales_percent',
        ...     constructor_salary_percent=10.0,
        ...     constructor_stage1_percent=None,
        ...     constructor_stage2_percent=None
        ... )
        >>> result['bonus']
        10000.0
        >>> result['stage1_amount']
        5000.0
        >>> result['current_debt']
        5000.0
    """
    # Step 1: Calculate total bonus
    bonus = calculate_bonus(
        order_price,
        material_cost,
        order_fixed_bonus,
        constructor_salary_mode,
        constructor_salary_percent
    )
    
    # Step 2: Calculate stage distribution
    stage1_amount, stage2_amount = calculate_stage_distribution(
        bonus,
        order_custom_stage1_percent,
        order_custom_stage2_percent,
        constructor_stage1_percent,
        constructor_stage2_percent
    )
    
    # Step 3: Calculate remaining amounts
    stage1_remaining = max(0, stage1_amount - stage1_paid)
    stage2_remaining = max(0, stage2_amount - stage2_paid)
    
    # Step 4: Calculate current debt
    current_debt = calculate_order_debt(
        stage1_amount,
        stage2_amount,
        stage1_paid,
        stage2_paid,
        order_date_to_work,
        order_date_installation
    )
    
    return {
        'bonus': bonus,
        'stage1_amount': stage1_amount,
        'stage2_amount': stage2_amount,
        'stage1_remaining': stage1_remaining,
        'stage2_remaining': stage2_remaining,
        'current_debt': current_debt
    }
