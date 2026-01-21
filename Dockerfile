# Stage 1: Build React Frontend
FROM node:18-alpine as frontend_build
WORKDIR /app/frontend

# Copy package.json and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy source code and build
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup Python Backend
FROM python:3.11-slim
WORKDIR /app

# Install System Dependencies (some python packages need build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy Backend Code
COPY backend/ ./backend/

# Copy Built Frontend Assets from Stage 1
COPY --from=frontend_build /app/frontend/dist ./frontend/dist

# Set Start Command
# We run from inside /app/backend/ so imports work naturally as they do locally
WORKDIR /app/backend

# Default port is 8000, but we use the PORT env var if provided (Railway does this)
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
