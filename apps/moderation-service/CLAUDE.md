# Moderation Service

Standalone FastAPI microservice that scores listing content and returns an automated moderation decision. The Forumo backend calls this via HTTP when a new listing is submitted. No ML model — decisions are based on keyword blocklists and image metadata heuristics.

## Tech stack

| | Version |
|---|---|
| Python | 3.x |
| FastAPI | 0.115.0 |
| Uvicorn | 0.30.3 |
| OpenTelemetry | 1.27.0 (API + SDK) |
| Pydantic | bundled with FastAPI |

No database. No external dependencies beyond the packages in `requirements.txt`.

## Run locally

```bash
cd apps/moderation-service

# Install dependencies
pip install -r requirements.txt

# Start server (port 5005)
uvicorn moderation_service.main:app --host 0.0.0.0 --port 5005 --reload
```

The service also starts automatically as part of `pnpm docker:up` (via `docker-compose.yml`).

## Key environment variables

None required by default. Configuration is in `moderation_service/config.py` via Pydantic `Settings`:
- `BANNED_KEYWORDS` — comma-separated list; any hit → REJECTED
- `FLAGGED_KEYWORDS` — comma-separated list; any hit → FLAGGED (manual review)
- `FLAGGED_MIME_PREFIXES` — MIME type prefixes that flag images
- `MAX_IMAGE_SIZE_MB` — images above this size reduce score

All have sensible defaults.

## API endpoints

```
GET  /healthz                        # Liveness check — returns {"status": "ok"}
GET  /metrics                        # Counters: processed/approved/flagged/rejected totals
POST /moderations/listings           # Score a listing; returns ModerationDecision
```

### Request body for `POST /moderations/listings`

```json
{
  "listing_id": "string",
  "seller_id": "string",
  "title": "string",
  "description": "string (optional)",
  "images": [
    {
      "url": "string",
      "mime_type": "string (optional)",
      "file_size": 12345
    }
  ]
}
```

### Response shape (`ModerationDecision`)

```json
{
  "listing_id": "string",
  "status": "APPROVED | FLAGGED | REJECTED",
  "score": 0.85,
  "labels": ["imagery_present"],
  "notes": "No policy violations detected."
}
```

## How the scoring works (`moderation_service/engine.py`)

1. Concatenate `title + description`, lowercase.
2. Check against `banned_keywords` — if any match: `status=REJECTED`, `score=0.0`.
3. Check against `flagged_keywords` — if any match (and not already rejected): `status=FLAGGED`, `score=0.35`.
4. Score images: flag by MIME type prefix or file size; `image_flagged` label overrides `APPROVED` to `FLAGGED`.
5. Default path (no hits): `status=APPROVED`, `score=0.85`.

## How the backend calls it

The backend `ListingsModule` (or a dedicated moderation sub-service) sends a POST request to `MODERATION_SERVICE_URL/moderations/listings` after a listing is created. The `MODERATION_SERVICE_URL`, `MODERATION_SERVICE_TIMEOUT_MS`, and `MODERATION_MAX_ATTEMPTS` env vars on the backend control this.

On success: listing status is updated based on the returned `status` field.  
On HTTP error or timeout: the backend retries up to `MODERATION_MAX_ATTEMPTS` times.

## Known limitations

- **No real ML model.** Decisions are deterministic keyword/heuristic rules. The `score` field is a fixed constant per outcome path, not a genuine probability.
- **No authentication on endpoints.** Any process that can reach port 5005 can call `/moderations/listings`. In production, this must be network-isolated (internal cluster network only) or protected by a shared secret header.
- **No persistent metrics.** The `/metrics` endpoint returns in-memory counters that reset on restart. Not integrated with Prometheus — metrics are JSON, not the Prometheus exposition format.
- **OTel traces export to console only.** The `ConsoleSpanExporter` is wired up. No OTLP exporter configured.
- **No test suite.** There are no `pytest` files in this package.

## File structure

```
moderation_service/
├── __init__.py
├── main.py       # FastAPI app, routes, OTel setup
├── engine.py     # ModerationEngine class with scoring logic
├── models.py     # Pydantic models: ListingModerationRequest, ModerationDecision, etc.
└── config.py     # Settings class (keyword lists, thresholds)
```
