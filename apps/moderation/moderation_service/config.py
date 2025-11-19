"""Runtime configuration helpers for the moderation service."""

from __future__ import annotations

from dataclasses import dataclass, field
import os
from functools import lru_cache
from typing import List


@dataclass
class Settings:
  """Environment-aware settings."""

  banned_keywords: List[str] = field(default_factory=list)
  flagged_keywords: List[str] = field(default_factory=list)
  flagged_mime_prefixes: List[str] = field(default_factory=lambda: ["image/svg", "image/x-icon"])
  max_image_size_mb: int = 20
  service_name: str = "Forumo Moderation Service"


def _parse_csv(value: str | None) -> List[str]:
  if not value:
    return []
  return [token.strip().lower() for token in value.split(',') if token.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
  """Load configuration from environment variables."""

  banned = _parse_csv(os.getenv('MODERATION_BANNED_KEYWORDS'))
  if not banned:
    banned = [
      'firearm',
      'weapon',
      'fentanyl',
      'ivory',
      'counterfeit',
    ]
  flagged = _parse_csv(os.getenv('MODERATION_FLAGGED_KEYWORDS'))
  if not flagged:
    flagged = ['replica', 'adult', 'lottery', 'knife']

  mime_prefixes = _parse_csv(os.getenv('MODERATION_FLAGGED_MIME_PREFIXES'))
  if not mime_prefixes:
    mime_prefixes = Settings.flagged_mime_prefixes

  max_image_size = os.getenv('MODERATION_MAX_IMAGE_SIZE_MB')
  try:
    max_image_size_mb = int(max_image_size) if max_image_size else Settings.max_image_size_mb
  except ValueError:
    max_image_size_mb = Settings.max_image_size_mb

  return Settings(
    banned_keywords=banned,
    flagged_keywords=flagged,
    flagged_mime_prefixes=mime_prefixes,
    max_image_size_mb=max_image_size_mb,
  )
