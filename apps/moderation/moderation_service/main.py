"""FastAPI entrypoint for the moderation service."""

from __future__ import annotations

from fastapi import FastAPI

from .engine import ModerationEngine
from .models import ListingModerationRequest, ModerationDecision

app = FastAPI(title='Forumo Moderation Service', version='0.1.0')
engine = ModerationEngine()


@app.get('/healthz')
def healthcheck() -> dict[str, str]:
  """Kubernetes-ready health endpoint."""

  return {'status': 'ok'}


@app.post('/moderations/listings', response_model=ModerationDecision)
def moderate_listing(payload: ListingModerationRequest) -> ModerationDecision:
  """Score a listing payload and return an automated decision."""

  return engine.score_listing(payload)
