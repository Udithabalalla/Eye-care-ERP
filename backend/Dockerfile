# Container image for the FastAPI backend (Google Cloud Run).
# Build from this directory:  docker build -t eye-care-api .
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# app/ plus static/ when present; .dockerignore keeps out env files, venvs and tests.
COPY . .

RUN useradd --create-home --uid 1000 appuser
USER appuser

# Cloud Run injects PORT (8080). One uvicorn process is enough: Cloud Run
# scales by adding instances, and each extra worker would load pandas again.
ENV PORT=8080
EXPOSE 8080
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips="*"
