import { LoggerService } from '@nestjs/common';
import { context, trace } from '@opentelemetry/api';
import pino, { LoggerOptions } from 'pino';

const buildTransport = (level: string): LoggerOptions => ({
  level,
  transport: level === 'debug' || level === 'trace' ? { target: 'pino-pretty' } : undefined,
});

export class TelemetryLogger implements LoggerService {
  private readonly logger = pino(buildTransport(process.env.LOG_LEVEL ?? 'debug'));

  log(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(this.withTrace(meta), message);
  }

  error(message: string, traceMessage?: string, meta?: Record<string, unknown>): void {
    this.logger.error(this.withTrace({ ...meta, trace: traceMessage }), message);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(this.withTrace(meta), message);
  }

  debug?(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(this.withTrace(meta), message);
  }

  verbose?(message: string, meta?: Record<string, unknown>): void {
    this.logger.trace(this.withTrace(meta), message);
  }

  private withTrace(meta?: Record<string, unknown>) {
    const activeSpan = trace.getSpan(context.active());
    const traceId = activeSpan?.spanContext().traceId;
    return { ...meta, traceId };
  }
}
