@echo off
setlocal

echo =============================================
echo Starting app-v2
echo =============================================

cd /d "%~dp0"

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%app-v2"
set "VENV_PY=%ROOT%.venv\Scripts\python.exe"
set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"

echo [1/2] Backend: http://127.0.0.1:8000
if exist "%VENV_PY%" (
    start "Backend API (app-v2)" powershell -NoExit -Command "Set-Location -LiteralPath '%BACKEND_DIR%'; & '%VENV_PY%' -m uvicorn main:app --reload --port 8000"
) else (
    echo ERROR: Python virtualenv not found: "%VENV_PY%"
    echo Please create .venv first.
)

echo [2/2] Frontend: http://127.0.0.1:5174
start "Frontend app-v2" powershell -NoExit -Command "Set-Location -LiteralPath '%FRONTEND_DIR%'; & '%NPM_CMD%' run dev -- --host 127.0.0.1 --port 5174"

echo Waiting for servers...
ping 127.0.0.1 -n 5 >nul

echo.
echo Open in browser: http://127.0.0.1:5174
echo Keep both terminal windows open.
echo =============================================
