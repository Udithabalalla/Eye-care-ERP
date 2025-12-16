#!/bin/bash
# Production startup script for Linux
# Uses gunicorn to run the application

# Activate virtual environment if it exists (adjust path as needed)
# source venv/bin/activate

# Run Gunicorn
# -w 4: 4 worker processes
# -k uvicorn.workers.UvicornWorker: Use Uvicorn worker class
# --bind 0.0.0.0:8000: Bind to all interfaces on port 8000
exec gunicorn -w 4 -k uvicorn.workers.UvicornWorker \
    --access-logfile - \
    --error-logfile - \
    --bind 0.0.0.0:8000 \
    app.main:app
