@echo off
echo Starting Furniture Payroll App...

:: Navigate to project root (in case run as admin or from elsewhere)
cd /d "%~dp0"

:: Start Backend
echo Starting Backend Server...
start "Backend API" cmd /k "cd backend && ..\.venv\Scripts\activate && uvicorn main:app --reload --port 8000"

:: Start Frontend
echo Starting Frontend Server...
start "Frontend App" cmd /k "cd frontend && npm run dev"

:: Wait for servers to initialize (5 seconds)
echo Waiting for servers to launch...
timeout /t 5 /nobreak >nul

:: Open Browser
echo Opening Browser...
start http://localhost:5173

echo.
echo ========================================================
echo App launched! Do not close the two black terminal windows.
echo To stop the app, close the terminal windows.
echo ========================================================
pause
