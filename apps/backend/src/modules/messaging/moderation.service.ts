import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageModerationStatus } from '@prisma/client';
import { firstValueFrom } from "rxjs";
import { SpanStatusCode, trace } from '@opentelemetry/api';

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
  private readonly tracer = trace.getTracer('messaging.moderation');

  constructor(private readonly httpService: HttpService, configService: ConfigService) {
    this.serviceUrl = configService.get<string>('MODERATION_SERVICE_URL') ?? 'http://localhost:5005';
    const timeoutValue = Number(configService.get<string>('MODERATION_SERVICE_TIMEOUT_MS') ?? 5000);
    this.timeoutMs = Number.isNaN(timeoutValue) ? 5000 : timeoutValue;
  }

  async scanMessage(payload: ModerationJobPayload): Promise<ModerationDecisionResult> {
    const span = this.tracer.startSpan('moderation.messages.scan', {
      attributes: {
        'thread.id': payload.threadId,
        'author.id': payload.authorId,
        attachments: payload.attachments.length,
      },
    });
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
      this.logStructured('log', 'Submitting message for moderation', {
        threadId: payload.threadId,
        authorId: payload.authorId,
      });
      const response = await firstValueFrom(
        this.httpService.post<ModerationDecisionResponse>(
          `${this.serviceUrl}/moderations/messages`,
          requestPayload,
          { timeout: this.timeoutMs },
        ),
      );
      const decision = this.mapDecision(response.data);
      this.logStructured('log', 'Message moderation completed', {
        threadId: payload.threadId,
        status: decision.status,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      return decision;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown moderation error';
      this.logStructured('error', 'Moderation service request failed', {
        threadId: payload.threadId,
        error: message,
      });
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message });
      return { status: MessageModerationStatus.FLAGGED, notes: 'Moderation unavailable. Manual review required.' };
    } finally {
      span.end();
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

  private logStructured(level: 'log' | 'error', message: string, context: Record<string, unknown>): void {
    const payload = JSON.stringify({ msg: message, ...context });
    this.logger[level](payload);
  }
}
