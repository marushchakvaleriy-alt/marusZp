@echo off
echo Оновлення налаштувань Марущака: 100%% після першого етапу
echo.

sqlite3 database.db "UPDATE user SET payment_stage1_percent = 100.0, payment_stage2_percent = 0.0 WHERE full_name LIKE '%%арущак%%' OR username LIKE '%%arushak%%';"

echo.
echo Перевірка результату:
echo.

sqlite3 database.db "SELECT username, full_name, salary_mode, salary_percent, payment_stage1_percent, payment_stage2_percent FROM user WHERE full_name LIKE '%%арущак%%' OR username LIKE '%%arushak%%';"

echo.
echo ✅ Готово! Марущак тепер отримує 100%% після конструктиву, 0%% після монтажу.
echo.
pause
