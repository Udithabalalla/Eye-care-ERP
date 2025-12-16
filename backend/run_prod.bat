@echo off
echo Starting Vision Optical Backend (Windows Production)
echo ====================================================

:: Note: Gunicorn doesn't work on Windows.
:: We use Uvicorn directly with multiple workers if needed,
:: or simply a direct Uvicorn launch.
:: For true production on Windows, consider using IIS or a service manager.

:: Activate virtual environment if needed
:: call venv\Scripts\activate

:: Run Uvicorn
:: --host 0.0.0.0: Allow access from other machines
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

echo.
echo Application stopped.
pause
