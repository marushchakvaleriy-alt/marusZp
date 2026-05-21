@echo off
chcp 65001 >nul
setlocal
color 0A
cls

echo ========================================================
echo    DEPLOY ALL TO FLY.IO
echo ========================================================
echo.

cd /d "%~dp0"

set "PATH=%USERPROFILE%\.fly\bin;%PATH%"
set "FLY_CMD=%USERPROFILE%\.fly\bin\fly.exe"

if not exist "%FLY_CMD%" (
    echo ERROR: fly.exe не знайдено за шляхом:
    echo %FLY_CMD%
    echo.
    echo Спочатку виконайте команду: fly auth login
    echo.
    pause
    exit /b 1
)

echo [1/2] Deploy backend...
pushd "%~dp0backend"
"%FLY_CMD%" deploy -a maruszp-backend
if errorlevel 1 (
    popd
    echo.
    echo ERROR: Не вдалося задеплоїти backend.
    echo Зупиняю сценарій, frontend не деплоївся.
    echo.
    pause
    exit /b 1
)
popd
echo OK: Backend deployed.
echo.

echo [2/2] Deploy frontend...
pushd "%~dp0frontend"
"%FLY_CMD%" deploy -a maruszp-frontend
if errorlevel 1 (
    popd
    echo.
    echo ERROR: Не вдалося задеплоїти frontend.
    echo Backend уже оновлено, але frontend ні.
    echo.
    pause
    exit /b 1
)
popd
echo OK: Frontend deployed.
echo.

echo ========================================================
echo    ГОТОВО! DEPLOY ЗАВЕРШЕНО
echo ========================================================
echo.
echo Перевірити:
echo Backend:  https://maruszp-backend.fly.dev/
echo Frontend: https://maruszp-frontend.fly.dev/
echo.
echo Якщо нові поля в БД не з'явилися автоматично, відкрий:
echo https://maruszp-backend.fly.dev/fix-db
echo.
pause
