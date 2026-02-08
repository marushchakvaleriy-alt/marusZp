@echo off
echo Оновлення замовлення тест1 на 100/0 розподіл
echo.

sqlite3 database.db "UPDATE \"order\" SET custom_stage1_percent = 100.0, custom_stage2_percent = 0.0 WHERE name = 'тест1';"

echo.
echo Перевірка результату:
echo.

sqlite3 database.db "SELECT id, name, price, custom_stage1_percent, custom_stage2_percent FROM \"order\" WHERE name LIKE '%%тест%%';"

echo.
echo ✅ Готово! Замовлення тест1 тепер 100%% / 0%%
echo.
echo ПЕРЕЗАПУСТІТЬ BACKEND І ОНОВІТЬ БРАУЗЕР!
echo.
pause
