# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime with built frontend
FROM python:3.11-slim

# Install Azure CLI so AzureCliCredential works inside the container
RUN apt-get update && apt-get install -y curl ca-certificates \
        libxcb1 libgl1 libglib2.0-0 libsm6 libxext6 && \
    curl -sL https://aka.ms/InstallAzureCLIDeb | bash && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
# Install in ordered steps. semantic-kernel and agent-framework-foundry pin
# incompatible azure-ai-projects versions (<2.0 vs >=2.0), so they cannot be
# resolved together in one pass. Install the base, let SK pull its deps, then
# force azure-ai-projects back to the 2.x line that Foundry requires. SK's
# in-memory vector store + embeddings do not use azure-ai-projects at runtime.
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir "semantic-kernel>=1.42.0" && \
    pip install --no-cache-dir "azure-ai-projects>=2.0.0,<3.0"

COPY backend/ ./backend/

COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 80

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "80"]
