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

## Authentication

**SECURITY GAP: there is no authentication on any endpoint.**

Any process that can reach port 5005 can call `/moderations/listings` and retrieve metrics. In production this must be either:
- Network-isolated (internal cluster network, never exposed externally), or
- Protected by a shared-secret header (e.g. `X-Internal-Token`) validated in a FastAPI dependency before any route handler runs.

Until that is in place, do not expose this service's port outside the private network.

## Key environment variables

| Variable | Default | Effect |
|---|---|---|
| `MODERATION_BANNED_KEYWORDS` | `firearm,weapon,fentanyl,ivory,counterfeit` | Comma-separated; any match → REJECTED |
| `MODERATION_FLAGGED_KEYWORDS` | `replica,adult,lottery,knife` | Comma-separated; any match → FLAGGED |
| `MODERATION_FLAGGED_MIME_PREFIXES` | `image/svg,image/x-icon` | MIME prefixes that trigger image flag |
| `MODERATION_MAX_IMAGE_SIZE_MB` | `20` | Images above this size reduce score |

All variables are parsed in `moderation_service/config.py`. The `get_settings()` function is `@lru_cache`-d — changing env vars at runtime requires a restart.

## API endpoints

### `GET /healthz`

Kubernetes liveness probe. No auth, no body.

**Response**

```json
{ "status": "ok" }
```

---

### `GET /metrics`

Returns in-memory counters since the last restart. No auth, no body. Not Prometheus format — plain JSON.

**Response**

```json
{
  "processed_total": 42,
  "approved_total": 35,
  "flagged_total": 5,
  "rejected_total": 2
}
```

Counters reset to zero on process restart. Not persisted anywhere.

---

### `POST /moderations/listings`

Scores a listing payload and returns an automated moderation decision.

**Request body** (`ListingModerationRequest`) — JSON, camelCase aliases accepted:

| Field | Type | Required | Notes |
|---|---|---|---|
| `listingId` | string | yes | Passed through to the response unchanged |
| `sellerId` | string | yes | Recorded in OTel span and logs only |
| `reason` | string | yes | e.g. `"new_listing"`, `"re-review"` — not used in scoring |
| `title` | string | yes | Combined with `description` for keyword scan |
| `description` | string | no | |
| `priceCents` | integer ≥ 0 | no | Not used in current scoring logic |
| `currency` | string | no | Not used in current scoring logic |
| `desiredStatus` | string | no | Not used in current scoring logic |
| `images` | array of image objects | no | Defaults to `[]`; empty array triggers `no_images_submitted` label |
| `variants` | array of variant objects | no | Not used in current scoring logic |

**Image object** (`ListingImage`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | |
| `url` | string | yes | |
| `mime_type` | string | no | Checked against `MODERATION_FLAGGED_MIME_PREFIXES` |
| `file_size` | integer ≥ 0 | no | Bytes; checked against `MODERATION_MAX_IMAGE_SIZE_MB` |

**Variant object** (`ListingVariant`) — not used in scoring, passed for future use:

| Field | Type | Required |
|---|---|---|
| `id` | string | no |
| `label` | string | yes |
| `price_cents` | integer | no |
| `currency` | string | no |
| `sku` | string | no |

**Example request**

```json
{
  "listingId": "lst_abc123",
  "sellerId": "usr_xyz789",
  "reason": "new_listing",
  "title": "Vintage leather jacket",
  "description": "Genuine leather, great condition",
  "priceCents": 45000,
  "currency": "ZAR",
  "images": [
    {
      "id": "img_001",
      "url": "https://cdn.forumo.app/images/img_001.jpg",
      "mime_type": "image/jpeg",
      "file_size": 2097152
    }
  ]
}
```

**Response** (`ModerationDecision`):

| Field | Type | Notes |
|---|---|---|
| `listing_id` | string | Echoes `listingId` from request |
| `status` | string | `"approved"`, `"flagged"`, or `"rejected"` (lowercase) |
| `score` | float 0.0–1.0 | Higher = safer; see thresholds below |
| `labels` | array of strings | Machine-readable tags explaining the decision |
| `notes` | string | Human-readable summary |

**Example response — approved**

```json
{
  "listing_id": "lst_abc123",
  "status": "approved",
  "score": 0.85,
  "labels": ["imagery_present"],
  "notes": "No policy violations detected."
}
```

**Example response — flagged**

```json
{
  "listing_id": "lst_def456",
  "status": "flagged",
  "score": 0.35,
  "labels": ["text_requires_review"],
  "notes": "Sensitive terms present: replica"
}
```

**Example response — rejected**

```json
{
  "listing_id": "lst_ghi789",
  "status": "rejected",
  "score": 0.0,
  "labels": ["banned_keyword"],
  "notes": "Blocked terms detected: firearm"
}
```

## Scoring thresholds (`moderation_service/engine.py`)

| Trigger | Status | Score |
|---|---|---|
| Any banned keyword in title+description | `rejected` | `0.0` |
| Any flagged keyword in title+description (no banned match) | `flagged` | `0.35` |
| `image_flagged` label on an otherwise approved listing | `flagged` | `0.4` |
| No text or image violations | `approved` | `0.85` |
| Each `image_too_large` label | _(score penalty)_ | `−0.05` (clamped to 0.0) |

**Scoring order**: banned keywords are checked first; if matched, flagged keywords and images are still evaluated for labels but do not change the status or score. Image penalties apply after the text score is set.

**Possible labels**:

| Label | Meaning |
|---|---|
| `banned_keyword` | Title/description matched a banned term |
| `text_requires_review` | Title/description matched a flagged term |
| `image_flagged` | An image's MIME type matched a flagged prefix |
| `image_too_large` | An image exceeded `MODERATION_MAX_IMAGE_SIZE_MB` |
| `no_images_submitted` | `images` array was empty |
| `imagery_present` | At least one image was provided |

## How to add a new heuristic rule

### Option A — extend keyword lists via env vars (no code change)

Add terms to `MODERATION_BANNED_KEYWORDS` or `MODERATION_FLAGGED_KEYWORDS` (comma-separated). Restart the service.

### Option B — edit the default keyword lists (`config.py`)

In `get_settings()`, edit the `banned` or `flagged` lists directly. Useful when the new term must ship as a hard default regardless of env configuration.

### Option C — add a new text or image check in `engine.py`

For rules that cannot be expressed as simple substring matches (price range, title length, seller reputation, custom image checks):

1. Add the check inside `score_listing()` in `ModerationEngine`, after the existing text and image blocks.
2. Assign a new label string to `labels`.
3. Adjust `status` and `score` using the same pattern as existing checks.
4. If the check depends on new config, add the field to `Settings` in `config.py` and read the env var in `get_settings()`.

**Example — reject listings with no price set:**

```python
# in score_listing(), after image scoring
if payload.price_cents is None and status == ModerationStatus.APPROVED:
    status = ModerationStatus.FLAGGED
    labels.append('price_missing')
    notes = 'Listing has no price; manual review required.'
    score = min(score, 0.4)
```

No other files need to change for a new rule — the engine is self-contained.

## How the backend calls it

The backend `ListingsModule` sends a POST request to `MODERATION_SERVICE_URL/moderations/listings` after a listing is created. Backend env vars that control this:

- `MODERATION_SERVICE_URL` — base URL (e.g. `http://moderation-service:5005`)
- `MODERATION_SERVICE_TIMEOUT_MS` — per-request timeout
- `MODERATION_MAX_ATTEMPTS` — retry count on HTTP error or timeout

On success the backend updates the listing status based on the returned `status` field. On HTTP error or timeout it retries up to `MODERATION_MAX_ATTEMPTS` times.

## File structure

```
moderation_service/
├── __init__.py
├── main.py       # FastAPI app, routes, OTel setup
├── engine.py     # ModerationEngine: score_listing(), _find_hits(), _score_images()
├── models.py     # Pydantic models: ListingModerationRequest, ModerationDecision, ListingImage, ListingVariant
└── config.py     # Settings dataclass; get_settings() reads env vars
```

## Known limitations

- **No real ML model.** Decisions are deterministic keyword/heuristic rules. The `score` field is a fixed constant per outcome path, not a genuine probability.
- **No authentication on endpoints.** See the Authentication section above.
- **No persistent metrics.** The `/metrics` endpoint returns in-memory counters that reset on restart. Not integrated with Prometheus — metrics are JSON, not the Prometheus exposition format.
- **OTel traces export to console only.** `ConsoleSpanExporter` is wired up. No OTLP exporter configured.
- **No test suite.** There are no `pytest` files in this package.
- **`get_settings()` is `@lru_cache`-d.** Keyword list changes via env vars require a process restart to take effect.
