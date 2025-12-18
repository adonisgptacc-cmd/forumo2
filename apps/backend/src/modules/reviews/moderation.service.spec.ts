import { ReviewStatus } from '@prisma/client';

import { ReviewModerationService } from "./moderation.service";

describe('ReviewModerationService', () => {
  const service = new ReviewModerationService();

  it('holds low ratings for moderation', () => {
    const decision = service.evaluate('Decent item', 2);

    expect(decision.status).toBe(ReviewStatus.PENDING);
    expect(decision.flags.some((flag) => flag.reason === 'auto_hold')).toBe(true);
  });

  it('blocks profanity and attaches flags', () => {
    const decision = service.evaluate('Total scam experience', 5);

    expect(decision.status).toBe(ReviewStatus.PENDING);
    expect(decision.flags.some((flag) => flag.reason === 'profanity')).toBe(true);
    expect(decision.notes).toContain('profanity');
  });

  it('publishes clean, high quality reviews', () => {
    const decision = service.evaluate('Loved the packaging and speed', 5);

    expect(decision.status).toBe(ReviewStatus.PUBLISHED);
    expect(decision.flags).toHaveLength(0);
  });
});
