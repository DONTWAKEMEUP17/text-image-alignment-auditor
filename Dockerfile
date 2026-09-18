# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS frontend-build

WORKDIR /build/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build


FROM python:3.11-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

RUN groupadd --system app && useradd --system --gid app --home-dir /app app

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --requirement requirements.txt

COPY server/ ./server/
COPY --from=frontend-build /build/client/dist/ ./client/dist/

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; port = os.environ.get('PORT', '8000'); urllib.request.urlopen('http://127.0.0.1:' + port + '/health/ready', timeout=2)"]

CMD ["sh", "-c", "exec uvicorn server.server:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log"]
