@echo off
echo ===================================================
echo   ВСТАНОВЛЕННЯ БІБЛІОТЕК БЕЗПЕКИ (РУЧНИЙ ЗАПУСК)
echo ===================================================
echo.

cd /d "c:\Users\marus\Desktop\Зарплата\backend"

echo Встановлюємо python-jose, passlib, bcrypt...
pip install "python-jose[cryptography]" "passlib[bcrypt]" python-multipart

echo.
echo ===================================================
echo   ГОТОВО! Якщо бачите "Successfully installed" або
echo   "Requirement already satisfied" - все добре.
echo ===================================================
pause
