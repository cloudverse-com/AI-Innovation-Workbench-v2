# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime with built frontend
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 80

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "80"]
