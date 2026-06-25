FROM python:3.11-slim

WORKDIR /app

# Install system deps for PyTorch CUDA
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 4100

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4100", "--workers", "1"]