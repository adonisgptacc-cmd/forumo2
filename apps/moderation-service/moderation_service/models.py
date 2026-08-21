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
  id: str = Field(max_length=64)
  url: HttpUrl | str = Field(max_length=2048)
  mime_type: Optional[str] = Field(default=None, max_length=100)
  file_size: Optional[int] = Field(default=None, ge=0)


class ListingVariant(BaseModel):
  id: Optional[str] = Field(default=None, max_length=64)
  label: str = Field(max_length=200)
  price_cents: Optional[int] = Field(default=None, ge=0)
  currency: Optional[str] = Field(default=None, max_length=8)
  sku: Optional[str] = Field(default=None, max_length=64)


class ListingModerationRequest(BaseModel):
  listing_id: str = Field(alias='listingId', max_length=64)
  seller_id: str = Field(alias='sellerId', max_length=64)
  reason: str = Field(max_length=32)
  title: str = Field(max_length=200)
  description: Optional[str] = Field(default=None, max_length=5000)
  price_cents: Optional[int] = Field(default=None, ge=0, alias='priceCents')
  currency: Optional[str] = Field(default=None, max_length=8)
  desired_status: Optional[str] = Field(default=None, alias='desiredStatus', max_length=32)
  images: List[ListingImage] = Field(default_factory=list, max_length=25)
  variants: List[ListingVariant] = Field(default_factory=list, max_length=100)

  class Config:
    populate_by_name = True


class ModerationDecision(BaseModel):
  listing_id: str
  status: ModerationStatus
  score: float = Field(ge=0, le=1)
  labels: List[str] = Field(default_factory=list)
  notes: Optional[str] = None
