"""
СКРИПТ ДЛЯ ОНОВЛЕННЯ НАЛАШТУВАНЬ МАРУЩАКА
==========================================

Встановлює розподіл етапів 100% / 0% для Марущака
"""

from database import get_session_context
from models import User

with get_session_context() as session:
    # Знайти Марущака
    marushak = session.query(User).filter(
        (User.full_name.like('%Марущак%')) | 
        (User.username.like('%arushak%'))
    ).first()
    
    if not marushak:
        print("❌ Марущака не знайдено!")
    else:
        print(f"✅ Знайдено: {marushak.full_name or marushak.username}")
        print(f"\nПоточні налаштування:")
        print(f"  salary_mode: {marushak.salary_mode}")
        print(f"  salary_percent: {marushak.salary_percent}")
        print(f"  payment_stage1_percent: {marushak.payment_stage1_percent}")
        print(f"  payment_stage2_percent: {marushak.payment_stage2_percent}")
        
        # Оновити розподіл
        marushak.payment_stage1_percent = 100.0
        marushak.payment_stage2_percent = 0.0
        
        session.add(marushak)
        session.commit()
        
        print(f"\n✅ ОНОВЛЕНО!")
        print(f"  Етап I: 100%")
        print(f"  Етап II: 0%")
        print(f"\nТепер всі НОВІ замовлення будуть розраховуватись правильно!")
        print(f"Старі замовлення (тест1, тест2) залишаться з старими розрахунками.")
