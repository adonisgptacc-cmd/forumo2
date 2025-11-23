import { z } from 'zod';

const optionalString = z.string().min(1).optional();

export const configSchema = z
  .object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().optional(),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),
    JWT_SECRET: z.string().min(1),
    JWT_TTL: z.coerce.number().int().positive().default(86_400),
    JWT_EXPIRES_IN: optionalString,
    REFRESH_TOKEN_EXPIRES_IN: optionalString,
    OTP_TTL: z.coerce.number().int().positive().default(300),
    OTP_DEVICE_RATE_LIMIT: z.coerce.number().int().nonnegative().default(5),
    OTP_DEVICE_RATE_WINDOW: z.coerce.number().int().positive().default(300),
    STRIPE_SECRET_KEY: z.string().min(1),
    UPLOADS_BUCKET: optionalString,
    REDIS_URL: optionalString,
    REDIS_TTL_SECONDS: z.coerce.number().int().nonnegative().optional(),
    MAILGUN_API_KEY: optionalString,
    MAILGUN_DOMAIN: optionalString,
    MAILGUN_EMAIL_FROM: optionalString,
    MAILGUN_API_BASE: optionalString,
    SNS_REGION: optionalString,
    SNS_ACCESS_KEY_ID: optionalString,
    SNS_SECRET_ACCESS_KEY: optionalString,
    SNS_SMS_SENDER_ID: optionalString,
    MODERATION_SERVICE_URL: optionalString,
    MODERATION_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    MODERATION_MAX_ATTEMPTS: z.coerce.number().int().positive().optional(),
    MODERATION_RETRY_BACKOFF_MS: z.coerce.number().int().nonnegative().optional(),
    MODERATION_WORKER_CONCURRENCY: z.coerce.number().int().positive().optional(),
    MINIO_ENDPOINT: optionalString,
    MINIO_PORT: z.coerce.number().int().positive().default(9000),
    MINIO_ACCESS_KEY: optionalString,
    MINIO_SECRET_KEY: optionalString,
    MINIO_USE_SSL: z.string().transform((value) => value === 'true').optional(),
    MINIO_BUCKET_NAME: optionalString,
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_FROM: optionalString,
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalString,
    ENABLE_METRICS: z.string().transform((value) => value === 'true').optional(),
    LOG_LEVEL: optionalString,
    METRICS_API_KEY: optionalString,
  })
  .superRefine((value, ctx) => {
    const mailgunValues = [value.MAILGUN_API_KEY, value.MAILGUN_DOMAIN];
    const hasMailgunValues = mailgunValues.some(Boolean);
    const missingMailgunValues = mailgunValues.filter((entry) => !entry).length;

    if (hasMailgunValues && missingMailgunValues > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MAILGUN_API_KEY and MAILGUN_DOMAIN must be provided together.',
        path: ['MAILGUN_API_KEY'],
      });
    }

    const snsValues = [value.SNS_REGION, value.SNS_ACCESS_KEY_ID, value.SNS_SECRET_ACCESS_KEY];
    const hasSnsValues = snsValues.some(Boolean);
    const missingSnsValues = snsValues.filter((entry) => !entry).length;

    if (hasSnsValues && missingSnsValues > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SNS_REGION, SNS_ACCESS_KEY_ID, and SNS_SECRET_ACCESS_KEY must all be provided together.',
        path: ['SNS_REGION'],
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;
