"""Simple heuristics that simulate AI moderation."""

from __future__ import annotations

from typing import List

from .config import Settings, get_settings
from .models import ListingImage, ListingModerationRequest, ModerationDecision, ModerationStatus


class ModerationEngine:
  """Deterministic moderation logic for local development."""

  def __init__(self, settings: Settings | None = None) -> None:
    self.settings = settings or get_settings()

  def score_listing(self, payload: ListingModerationRequest) -> ModerationDecision:
    labels: List[str] = []
    status = ModerationStatus.APPROVED
    notes = 'No policy violations detected.'
    score = 0.85

    normalized_text = f"{payload.title} {payload.description or ''}".lower()
    banned_hits = self._find_hits(normalized_text, self.settings.banned_keywords)
    flagged_hits = self._find_hits(normalized_text, self.settings.flagged_keywords)

    if banned_hits:
      status = ModerationStatus.REJECTED
      labels.append('banned_keyword')
      notes = f"Blocked terms detected: {', '.join(banned_hits)}"
      score = 0.0
    elif flagged_hits:
      status = ModerationStatus.FLAGGED
      labels.append('text_requires_review')
      notes = f"Sensitive terms present: {', '.join(flagged_hits)}"
      score = 0.35

    image_labels = self._score_images(payload.images)
    labels.extend(image_labels)
    score = max(0.0, min(1.0, score - (0.05 * image_labels.count('image_too_large'))))

    if status == ModerationStatus.APPROVED and 'image_flagged' in image_labels:
      status = ModerationStatus.FLAGGED
      notes = 'Image metadata triggered manual review.'
      score = 0.4

    return ModerationDecision(
      listing_id=payload.listing_id,
      status=status,
      score=round(score, 2),
      labels=labels,
      notes=notes,
    )

  def _find_hits(self, haystack: str, needles: List[str]) -> List[str]:
    return [needle for needle in needles if needle in haystack]

  def _score_images(self, images: List[ListingImage]) -> List[str]:
    labels: List[str] = []
    for image in images:
      if image.mime_type:
        normalized_mime = image.mime_type.lower()
        if any(normalized_mime.startswith(prefix) for prefix in self.settings.flagged_mime_prefixes):
          labels.append('image_flagged')
      if image.file_size and image.file_size > self.settings.max_image_size_mb * 1024 * 1024:
        labels.append('image_too_large')
    if not images:
      labels.append('no_images_submitted')
    else:
      labels.append('imagery_present')
    return labels
