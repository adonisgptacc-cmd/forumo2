import { Injectable } from '@nestjs/common';
import { ReviewStatus } from '@prisma/client';

export interface ModerationDecision {
  status: ReviewStatus;
  notes: string | null;
  flags: Array<{ reason: string; notes?: string }>; 
}

@Injectable()
export class ReviewModerationService {
  private readonly profanityList = ['spam', 'scam', 'fraud', 'fake', 'damn'];

  evaluate(content: string, rating: number): ModerationDecision {
    const normalized = content.toLowerCase();
    const flags: ModerationDecision['flags'] = [];
    let status: ReviewStatus = ReviewStatus.PUBLISHED;
    let notes: string | null = null;

    if (rating <= 2) {
      status = ReviewStatus.PENDING;
      notes = 'Low rating requires manual review';
      flags.push({ reason: 'auto_hold', notes: 'Low rating threshold triggered hold' });
    }

    const hasProfanity = this.profanityList.some((word) => normalized.includes(word));
    if (hasProfanity) {
      status = ReviewStatus.PENDING;
      notes = notes ? `${notes}; Contains profanity` : 'Contains profanity';
      flags.push({ reason: 'profanity', notes: 'Detected flagged language' });
    }

    return { status, notes, flags };
  }
}
