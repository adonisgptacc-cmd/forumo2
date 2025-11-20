import { z } from 'zod';

const optionalString = z.string().min(1).optional();

export const configSchema = z
  .object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    JWT_SECRET: z.string().min(1),
    JWT_TTL: z.coerce.number().int().positive().default(86_400),
    OTP_TTL: z.coerce.number().int().positive().default(300),
    OTP_DEVICE_RATE_LIMIT: z.coerce.number().int().nonnegative().default(5),
    OTP_DEVICE_RATE_WINDOW: z.coerce.number().int().positive().default(300),
    STRIPE_SECRET_KEY: z.string().min(1),
    UPLOADS_BUCKET: optionalString,
    REDIS_URL: optionalString,
    SES_REGION: optionalString,
    SES_ACCESS_KEY_ID: optionalString,
    SES_SECRET_ACCESS_KEY: optionalString,
    SES_EMAIL_FROM: optionalString,
    TWILIO_ACCOUNT_SID: optionalString,
    TWILIO_AUTH_TOKEN: optionalString,
    TWILIO_FROM_NUMBER: optionalString,
    MODERATION_SERVICE_URL: optionalString,
    MODERATION_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    MODERATION_MAX_ATTEMPTS: z.coerce.number().int().positive().optional(),
    MODERATION_RETRY_BACKOFF_MS: z.coerce.number().int().nonnegative().optional(),
    MODERATION_WORKER_CONCURRENCY: z.coerce.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    const sesValues = [value.SES_REGION, value.SES_ACCESS_KEY_ID, value.SES_SECRET_ACCESS_KEY];
    const hasSesValues = sesValues.some(Boolean);
    const missingSesValues = sesValues.filter((entry) => !entry).length;

    if (hasSesValues && missingSesValues > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SES_REGION, SES_ACCESS_KEY_ID, and SES_SECRET_ACCESS_KEY must all be provided together.',
        path: ['SES_REGION'],
      });
    }

    const twilioValues = [value.TWILIO_ACCOUNT_SID, value.TWILIO_AUTH_TOKEN, value.TWILIO_FROM_NUMBER];
    const hasTwilioValues = twilioValues.some(Boolean);
    const missingTwilioValues = twilioValues.filter((entry) => !entry).length;

    if (hasTwilioValues && missingTwilioValues > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER must all be provided together.',
        path: ['TWILIO_ACCOUNT_SID'],
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;
