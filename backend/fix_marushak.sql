"""
SQL скрипт для оновлення Марущака
"""

UPDATE user 
SET 
    payment_stage1_percent = 100.0,
    payment_stage2_percent = 0.0
WHERE 
    full_name LIKE '%арущак%' 
    OR username LIKE '%arushak%';

-- Перевірити результат:
SELECT 
    id, 
    username, 
    full_name, 
    salary_mode,
    salary_percent,
    payment_stage1_percent, 
    payment_stage2_percent
FROM user
WHERE full_name LIKE '%арущак%' OR username LIKE '%arushak%';
