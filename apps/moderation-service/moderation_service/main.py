"""FastAPI entrypoint for the moderation service."""

from __future__ import annotations

import json
import logging

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor
from opentelemetry.trace import Status, StatusCode

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


@app.get('/healthz')
def healthcheck() -> dict[str, str]:
  """Kubernetes-ready health endpoint."""

  return {'status': 'ok'}


@app.get('/metrics')
def metrics() -> dict[str, int]:
  """Expose moderation counters for operations dashboards."""

  return engine.get_metrics()


@app.post('/moderations/listings', response_model=ModerationDecision)
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
