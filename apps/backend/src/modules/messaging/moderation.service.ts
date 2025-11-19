import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageModerationStatus } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

interface ModerationAttachmentPayload {
  url: string;
  mimeType?: string | null;
  fileSize?: number | null;
}

interface ModerationJobPayload {
  threadId: string;
  authorId: string;
  body: string;
  attachments: ModerationAttachmentPayload[];
}

interface ModerationDecisionResponse {
  status: 'approved' | 'flagged' | 'rejected';
  score: number;
  notes?: string | null;
}

interface ModerationDecisionResult {
  status: MessageModerationStatus;
  notes?: string | null;
}

@Injectable()
export class MessageModerationService {
  private readonly logger = new Logger(MessageModerationService.name);
  private readonly serviceUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly httpService: HttpService, configService: ConfigService) {
    this.serviceUrl = configService.get<string>('MODERATION_SERVICE_URL') ?? 'http://localhost:5005';
    const timeoutValue = Number(configService.get<string>('MODERATION_SERVICE_TIMEOUT_MS') ?? 5000);
    this.timeoutMs = Number.isNaN(timeoutValue) ? 5000 : timeoutValue;
  }

  async scanMessage(payload: ModerationJobPayload): Promise<ModerationDecisionResult> {
    const requestPayload = {
      thread_id: payload.threadId,
      author_id: payload.authorId,
      body: payload.body,
      attachments: payload.attachments.map((attachment) => ({
        url: attachment.url,
        mime_type: attachment.mimeType ?? undefined,
        file_size: attachment.fileSize ?? undefined,
      })),
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<ModerationDecisionResponse>(
          `${this.serviceUrl}/moderations/messages`,
          requestPayload,
          { timeout: this.timeoutMs },
        ),
      );
      return this.mapDecision(response.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown moderation error';
      this.logger.error(`Moderation service request failed for thread ${payload.threadId}: ${message}`);
      return { status: MessageModerationStatus.FLAGGED, notes: 'Moderation unavailable. Manual review required.' };
    }
  }

  private mapDecision(response: ModerationDecisionResponse): ModerationDecisionResult {
    const statusMap: Record<ModerationDecisionResponse['status'], MessageModerationStatus> = {
      approved: MessageModerationStatus.APPROVED,
      flagged: MessageModerationStatus.FLAGGED,
      rejected: MessageModerationStatus.REJECTED,
    };
    return {
      status: statusMap[response.status] ?? MessageModerationStatus.FLAGGED,
      notes: response.notes ?? null,
    };
  }
}
