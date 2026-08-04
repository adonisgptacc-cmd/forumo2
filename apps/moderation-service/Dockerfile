FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5005

CMD ["uvicorn", "moderation_service.main:app", "--host", "0.0.0.0", "--port", "5005"]
