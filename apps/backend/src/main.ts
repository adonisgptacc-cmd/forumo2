import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe, cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './modules/app.module.js';
import { ConfigService } from '@nestjs/config';
import { startTracing } from './telemetry/tracer.js';
import { TelemetryLogger } from './telemetry/logger.js';

async function bootstrap() {
  const logger = new TelemetryLogger();
  const app = await NestFactory.create(AppModule, { cors: true, logger });
  const configService = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ZodValidationPipe());

  const otlpEndpoint = configService.get<string>('OTEL_EXPORTER_OTLP_ENDPOINT');
  const telemetry = startTracing({
    serviceName: 'forumo-backend',
    environment: configService.get<string>('NODE_ENV') ?? 'development',
    endpoint: otlpEndpoint,
    samplingRatio: (configService.get<string>('NODE_ENV') ?? 'development') === 'development' ? 1 : 0.1,
  });

  const config = new DocumentBuilder()
    .setTitle('Forumo API')
    .setDescription('MVP gateway for buyers, sellers, admins, and automations')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document));

  await app.listen(process.env.PORT ?? 4000);

  const shutdown = async () => {
    await telemetry.shutdown().catch(() => undefined);
    await app.close();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
