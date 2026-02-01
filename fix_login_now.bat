@echo off
cd backend
echo Installing bcrypt...
pip install bcrypt
echo Running password reset...
python manual_reset.py
pause
