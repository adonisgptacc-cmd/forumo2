# Forumo Moderation Service

This FastAPI service provides lightweight AI-assisted moderation for listings and image uploads. The NestJS backend forwards listing payloads to this service so that all seller submissions are scored before they can be published.

## Features

- REST endpoints for listing moderation and service health checks.
- Simple NLP + metadata heuristics that flag or reject suspicious content.
- Deterministic scores so automated tests can assert on moderation outcomes.
- Environment-driven keyword configuration for local experimentation.

## Running locally

```bash
cd apps/moderation
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn moderation_service.main:app --reload --port 5005
```

The service listens on `http://localhost:5005` by default. Adjust the port via `uvicorn` flags if needed and update `MODERATION_SERVICE_URL` in the backend environment accordingly.

## API

- `GET /healthz` – readiness probe used by Docker/Kubernetes.
- `POST /moderations/listings` – scores a listing payload and returns a decision:

```json
{
  "listing_id": "uuid",
  "seller_id": "seller-123",
  "title": "Vintage camera",
  "description": "Fully functional.",
  "reason": "listing_created",
  "images": [{ "id": "img-1", "url": "https://...", "mime_type": "image/jpeg" }]
}
```

Response:

```json
{
  "status": "approved",
  "score": 0.92,
  "labels": ["text_safe", "imagery_ok"],
  "notes": "No policy violations detected"
}
```

Statuses map directly to the `ListingModerationStatus` enum in Prisma (`approved`, `flagged`, `rejected`). A `flagged` response pauses the listing and requires manual review in the admin console.
