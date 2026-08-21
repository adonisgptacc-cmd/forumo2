"""FastAPI entrypoint for the moderation service."""

from __future__ import annotations

import hmac
import json
import logging
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor
from opentelemetry.trace import Status, StatusCode

from .config import get_settings
from .engine import ModerationEngine
from .models import ListingModerationRequest, ModerationDecision

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger('moderation.api')

if not isinstance(trace.get_tracer_provider(), TracerProvider):
  provider = TracerProvider(resource=Resource.create({'service.name': 'forumo-moderation-service'}))
  provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
  trace.set_tracer_provider(provider)

tracer = trace.get_tracer('moderation.api')

app = FastAPI(title='Forumo Moderation Service', version='0.1.0')
engine = ModerationEngine()


def log_event(event: str, **kwargs: object) -> None:
  logger.info(json.dumps({'event': event, **kwargs}))


def require_internal_token(x_internal_token: Optional[str] = Header(default=None)) -> None:
  """Fail-closed shared-secret auth for internal endpoints.

  Endpoints guarded by this dependency reject any request that does not carry
  the exact `X-Internal-Token` value configured via MODERATION_INTERNAL_TOKEN.
  If the token is not configured the endpoints refuse to serve (503) rather
  than silently opening access.
  """
  expected = get_settings().internal_token
  if not expected:
    raise HTTPException(status_code=503, detail='Moderation service auth is not configured')
  if not x_internal_token or not hmac.compare_digest(x_internal_token, expected):
    raise HTTPException(status_code=401, detail='Unauthorized')


@app.get('/healthz')
def healthcheck() -> dict[str, str]:
  """Kubernetes-ready health endpoint."""

  return {'status': 'ok'}


@app.get('/metrics', dependencies=[Depends(require_internal_token)])
def metrics() -> dict[str, int]:
  """Expose moderation counters for operations dashboards."""

  return engine.get_metrics()


@app.post('/moderations/listings', response_model=ModerationDecision, dependencies=[Depends(require_internal_token)])
def moderate_listing(payload: ListingModerationRequest) -> ModerationDecision:
  """Score a listing payload and return an automated decision."""

  with tracer.start_as_current_span(
    'api.moderate_listing',
    attributes={'listing.id': payload.listing_id, 'seller.id': payload.seller_id},
  ) as span:
    log_event('moderation_request_received', listingId=payload.listing_id, sellerId=payload.seller_id)
    decision = engine.score_listing(payload)
    log_event(
      'moderation_decision_returned',
      listingId=payload.listing_id,
      status=decision.status,
      score=decision.score,
    )
    span.set_status(Status(StatusCode.OK))
    span.set_attribute('moderation.score', decision.score)
    return decision
