import { Injectable, Logger } from '@nestjs/common';

interface ModerationJobPayload {
  listingId: string;
  sellerId: string;
  reason: string;
}

@Injectable()
export class ModerationQueueService {
  private readonly logger = new Logger(ModerationQueueService.name);

  async enqueueListingScan(payload: ModerationJobPayload): Promise<void> {
    this.logger.debug(`Queued moderation job`, payload);
  }
}
