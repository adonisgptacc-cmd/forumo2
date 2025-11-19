import 'reflect-metadata';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ParameterMetadataAccessor } from '@nestjs/swagger/dist/services/parameter-metadata-accessor.js';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from '../src/modules/app.module.js';
import {
  ModerationQueueMetrics,
  ModerationQueueService,
} from '../src/modules/listings/moderation-queue.service.js';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy.js';
import { OtpDeliveryService } from '../src/modules/auth/otp-delivery.service.js';
import { MessageModerationService } from '../src/modules/messaging/moderation.service.js';
import { MessageModerationStatus, NotificationChannel } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service.js';

const moderationQueueStub: Pick<ModerationQueueService, 'enqueueListingScan' | 'getMetrics'> & {
  getMetrics(): Promise<ModerationQueueMetrics>;
} = {
  async enqueueListingScan() {
    return Promise.resolve();
  },
  async getMetrics() {
    return {
      available: false,
      waiting: 0,
      delayed: 0,
      failed: 0,
      active: 0,
      completed: 0,
      backlogDepth: 0,
      failureRate: 0,
      deadLetterSize: 0,
      lastFailureAt: null,
    } satisfies ModerationQueueMetrics;
  },
};

const requiredEnv: Record<string, string> = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/forumo',
  JWT_SECRET: 'swagger-secret',
  SES_REGION: 'us-east-1',
  SES_ACCESS_KEY_ID: 'fake-access-key',
  SES_SECRET_ACCESS_KEY: 'fake-secret',
  TWILIO_ACCOUNT_SID: 'twilio-sid',
  TWILIO_AUTH_TOKEN: 'twilio-token',
  TWILIO_FROM_NUMBER: '+10000000000',
};

for (const [key, value] of Object.entries(requiredEnv)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

class StaticConfigService {
  get<T = string>(key: string): T | undefined {
    return (process.env[key] ?? requiredEnv[key]) as T | undefined;
  }

  getOrThrow<T = string>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined || value === null) {
      throw new Error(`Missing configuration for ${key}`);
    }
    return value;
  }
}

const otpDeliveryStub: Pick<OtpDeliveryService, 'deliver'> = {
  async deliver() {
    return {
      channel: NotificationChannel.EMAIL,
      provider: 'stub',
      referenceId: 'stub-ref',
      metadata: null,
      deliveredAt: new Date(),
    };
  },
};

const messageModerationStub: Pick<MessageModerationService, 'scanMessage'> = {
  async scanMessage() {
    return { status: MessageModerationStatus.APPROVED, notes: null };
  },
};

const prismaStub: Pick<PrismaService, '$connect' | '$disconnect' | 'enableShutdownHooks'> = {
  async $connect() {
    return Promise.resolve();
  },
  async $disconnect() {
    return Promise.resolve();
  },
  async enableShutdownHooks() {
    return Promise.resolve();
  },
};

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const originalParameterExplorer = ParameterMetadataAccessor.prototype.explore;
ParameterMetadataAccessor.prototype.explore = function patchedExplore(...args) {
  try {
    return originalParameterExplorer.apply(this, args as Parameters<typeof originalParameterExplorer>);
  } catch (error) {
    if (error instanceof TypeError) {
      return [];
    }
    throw error;
  }
};

async function generateOpenApiSpec() {
  const testingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ModerationQueueService)
    .useValue(moderationQueueStub)
    .overrideProvider(ConfigService)
    .useValue(new StaticConfigService())
    .overrideProvider(JwtStrategy)
    .useValue({ validate: async () => null })
    .overrideProvider(OtpDeliveryService)
    .useValue(otpDeliveryStub)
    .overrideProvider(MessageModerationService)
    .useValue(messageModerationStub)
    .overrideProvider(PrismaService)
    .useValue(prismaStub)
    .compile();

  const app = testingModule.createNestApplication();
  try {
    app.setGlobalPrefix('api/v1');
    await app.init();

    const config = new DocumentBuilder()
      .setTitle('Forumo API')
      .setDescription('MVP gateway for buyers, sellers, admins, and automations')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const cleanedDocument = cleanupOpenApiDoc(document);
    const outputDir = resolve(__dirname, '../../../docs');
    const outputPath = resolve(outputDir, 'openapi.json');

    await mkdir(outputDir, { recursive: true });
    await writeFile(outputPath, JSON.stringify(cleanedDocument, null, 2));
  } finally {
    await app.close();
  }
}

generateOpenApiSpec().catch((error) => {
  console.error('Failed to generate OpenAPI spec:', error);
  process.exitCode = 1;
});
