"""Pydantic models shared across endpoints."""

from __future__ import annotations

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, HttpUrl


class ModerationStatus(str, Enum):
  APPROVED = 'approved'
  FLAGGED = 'flagged'
  REJECTED = 'rejected'


class ListingImage(BaseModel):
  id: str
  url: HttpUrl | str
  mime_type: Optional[str] = None
  file_size: Optional[int] = Field(default=None, ge=0)


class ListingVariant(BaseModel):
  id: Optional[str] = None
  label: str
  price_cents: Optional[int] = None
  currency: Optional[str] = None
  sku: Optional[str] = None


class ListingModerationRequest(BaseModel):
  listing_id: str = Field(alias='listingId')
  seller_id: str = Field(alias='sellerId')
  reason: str
  title: str
  description: Optional[str] = None
  price_cents: Optional[int] = Field(default=None, ge=0, alias='priceCents')
  currency: Optional[str] = None
  desired_status: Optional[str] = Field(default=None, alias='desiredStatus')
  images: List[ListingImage] = Field(default_factory=list)
  variants: List[ListingVariant] = Field(default_factory=list)

  class Config:
    populate_by_name = True


class ModerationDecision(BaseModel):
  listing_id: str
  status: ModerationStatus
  score: float = Field(ge=0, le=1)
  labels: List[str] = Field(default_factory=list)
  notes: Optional[str] = None
