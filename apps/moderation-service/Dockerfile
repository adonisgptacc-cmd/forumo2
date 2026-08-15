FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home --shell /bin/bash appuser
USER appuser

EXPOSE 5005

CMD ["uvicorn", "moderation_service.main:app", "--host", "0.0.0.0", "--port", "5005"]
