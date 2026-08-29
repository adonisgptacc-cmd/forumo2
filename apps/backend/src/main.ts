import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { webcrypto } from "node:crypto";
import { ZodValidationPipe, cleanupOpenApiDoc } from "nestjs-zod";
import { AppModule } from "./modules/app.module";
import { ConfigService } from "@nestjs/config";
import { startTracing } from "./telemetry/tracer";
import { TelemetryLogger } from "./telemetry/logger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
  });
}

function validateEnv() {
  const required = ["DATABASE_URL", "JWT_SECRET"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(
      `[startup] Missing required environment variables: ${missing.join(", ")}`,
    );
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production") {
    if (process.env.NEXT_PUBLIC_USE_API_MOCKS === "true")
      throw new Error(
        "Production cannot run with NEXT_PUBLIC_USE_API_MOCKS=true",
      );
    if (process.env.JWT_SECRET?.includes("dev-"))
      throw new Error("Production JWT_SECRET must not contain dev-");
    if (process.env.MODERATION_INTERNAL_TOKEN === "dev-moderation-token")
      throw new Error("Production MODERATION_INTERNAL_TOKEN must be set");
  }
}

async function bootstrap() {
  validateEnv();

  const telemetry = startTracing({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "forumo-backend",
    environment: process.env.NODE_ENV ?? "development",
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    samplingRatio: process.env.NODE_ENV === "production" ? 0.1 : 1,
  });

  const logger = new TelemetryLogger();
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS ?? "http://localhost:3000"
  )
    .split(",")
    .map((o) => o.trim());
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Required for Stripe webhook signature verification
    cors: {
      origin: (origin, cb) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    },
    logger,
  });
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }, // allow images to load cross-origin
      contentSecurityPolicy:
        process.env.NODE_ENV === "production"
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", ...allowedOrigins],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
                upgradeInsecureRequests: [],
              },
            }
          : false,
    }),
  );
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
  void app.get(ConfigService);
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ZodValidationPipe());

  const config = new DocumentBuilder()
    .setTitle("Forumo API")
    .setDescription("MVP gateway for buyers, sellers, admins, and automations")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  if (process.env.NODE_ENV !== "production") {
    SwaggerModule.setup("docs", app, cleanupOpenApiDoc(document));
  }

  const port = process.env.PORT ?? 4000;
  await app.listen(port, "0.0.0.0");
  console.log(`🚀 Backend listening on http://0.0.0.0:${port}`);
  console.log(`📚 API Docs available at http://localhost:${port}/docs`);

  const shutdown = async () => {
    await telemetry.shutdown().catch(() => undefined);
    await app.close();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((err) => {
  console.error("Failed to bootstrap application:", err);
  process.exit(1);
});
