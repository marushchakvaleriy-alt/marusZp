"""
TEST SCRIPT FOR SALARY CALCULATIONS
====================================

Run this script to see examples of calculations and verify logic.

Usage:
    python backend/test_calculations.py
"""

from salary_calculator import calculate_order_financials


def print_example(title, **kwargs):
    """Print a calculation example."""
    print(f"\n{'='*70}")
    print(f"📊 {title}")
    print('='*70)
    
    result = calculate_order_financials(**kwargs)
    
    print(f"\nВХІДНІ ДАНІ:")
    print(f"  Ціна замовлення: {kwargs['order_price']:,.0f} грн")
    if kwargs.get('material_cost'):
        print(f"  Вартість матеріалів: {kwargs['material_cost']:,.0f} грн")
    if kwargs.get('order_fixed_bonus'):
        print(f"  Фіксована ціна (manager): {kwargs['order_fixed_bonus']:,.0f} грн")
    
    print(f"\nНАЛАШТУВАННЯ КОНСТРУКТОРА:")
    print(f"  Режим: {kwargs['constructor_salary_mode']}")
    print(f"  Відсоток/Сума: {kwargs['constructor_salary_percent']}")
    if kwargs.get('constructor_stage1_percent'):
        print(f"  Розподіл: {kwargs['constructor_stage1_percent']:.0f}/{kwargs['constructor_stage2_percent']:.0f}")
    
    print(f"\nРЕЗУЛЬТАТ:")
    print(f"  💰 ЗАГАЛЬНА ЗАРПЛАТА: {result['bonus']:,.2f} грн")
    print(f"  📐 Етап I (Конструктив): {result['stage1_amount']:,.2f} грн")
    print(f"  🔨 Етап II (Монтаж): {result['stage2_amount']:,.2f} грн")
    
    if kwargs['order_date_to_work'] or kwargs['order_date_installation']:
        print(f"\n  Вже оплачено:")
        print(f"    Етап I: {kwargs['stage1_paid']:,.2f} грн")
        print(f"    Етап II: {kwargs['stage2_paid']:,.2f} грн")
        print(f"\n  ❗ ПОТОЧНИЙ БОРГ: {result['current_debt']:,.2f} грн")


if __name__ == "__main__":
    print("\n" + "="*70)
    print("🧮 ТЕСТУВАННЯ РОЗРАХУНКІВ ЗАРПЛАТИ")
    print("="*70)
    
    # ==========================================================================
    # ПРИКЛАД 1: Стандартний - 10% від ціни продажу, 50/50
    # ==========================================================================
    print_example(
        "Приклад 1: Марущак, 10% від продажу, замовлення 100,000 грн",
        order_price=100000,
        material_cost=None,
        order_fixed_bonus=None,
        order_custom_stage1_percent=None,
        order_custom_stage2_percent=None,
        order_date_to_work='2024-01-15',  # Розпочато
        order_date_installation=None,  # Ще не на монтажі
        stage1_paid=0,  # Ще не оплачено
        stage2_paid=0,
        constructor_salary_mode='sales_percent',
        constructor_salary_percent=10.0
    )
    
    # ==========================================================================
    # ПРИКЛАД 2: Фіксована ціна (manager override)
    # ==========================================================================
    print_example(
        "Приклад 2: Manager встановив фіксовану ціну 15,000 грн",
        order_price=100000,
        material_cost=None,
        order_fixed_bonus=15000,  # Manager override!
        order_custom_stage1_percent=None,
        order_custom_stage2_percent=None,
        order_date_to_work='2024-01-15',
        order_date_installation='2024-02-01',  # На монтажі
        stage1_paid=7500,  # Етап I оплачено
        stage2_paid=0,  # Етап II не оплачено
        constructor_salary_mode='sales_percent',
        constructor_salary_percent=10.0  # Буде ігноруватись через fixed_bonus
    )
    
    # ==========================================================================
    # ПРИКЛАД 3: 10% від матеріалів
    # ==========================================================================
    print_example(
        "Приклад 3: Рудий, 10% від матеріалів (50,000 грн)",
        order_price=100000,
        material_cost=50000,
        order_fixed_bonus=None,
        order_custom_stage1_percent=None,
        order_custom_stage2_percent=None,
        order_date_to_work=None,  # Ще не розпочато
        order_date_installation=None,
        stage1_paid=0,
        stage2_paid=0,
        constructor_salary_mode='materials_percent',
        constructor_salary_percent=10.0
    )
    
    # ==========================================================================
    # ПРИКЛАД 4: Нестандартний розподіл 70/30
    # ==========================================================================
    print_example(
        "Приклад 4: 5% від продажу, але 70% після конструктиву, 30% після монтажу",
        order_price=100000,
        material_cost=None,
        order_fixed_bonus=None,
        order_custom_stage1_percent=None,
        order_custom_stage2_percent=None,
        order_date_to_work='2024-01-15',
        order_date_installation='2024-02-01',
        stage1_paid=0,
        stage2_paid=0,
        constructor_salary_mode='sales_percent',
        constructor_salary_percent=5.0,
        constructor_stage1_percent=70.0,
        constructor_stage2_percent=30.0
    )
    
    # ==========================================================================
    # ПРИКЛАД 5: Фіксована сума за замовлення (fixed_amount mode)
    # ==========================================================================
    print_example(
        "Приклад 5: Режим 'фіксована ціна' - 2000 грн за кожне замовлення",
        order_price=100000,
        material_cost=None,
        order_fixed_bonus=None,
        order_custom_stage1_percent=None,
        order_custom_stage2_percent=None,
        order_date_to_work='2024-01-15',
        order_date_installation=None,
        stage1_paid=1000,  # Частково оплачено
        stage2_paid=0,
        constructor_salary_mode='fixed_amount',
        constructor_salary_percent=2000  # Тут зберігається фіксована сума!
    )
    
    print("\n" + "="*70)
    print("✅ Тестування завершено!")
    print("="*70 + "\n")
