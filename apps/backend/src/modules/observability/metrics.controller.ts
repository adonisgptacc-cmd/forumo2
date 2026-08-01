import {
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import { MetricsService } from "./metrics.service";

function matchesApiKey(expected: string, provided?: string): boolean {
  if (!provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

@Controller("metrics")
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Header("Content-Type", "text/plain; version=0.0.4")
  async metrics(@Headers("x-api-key") apiKey?: string): Promise<string> {
    const metricsApiKey = this.configService.get<string>("METRICS_API_KEY");
    const environment =
      this.configService.get<string>("NODE_ENV") ?? "development";

    if (environment !== "development") {
      if (!metricsApiKey || !matchesApiKey(metricsApiKey, apiKey)) {
        throw new UnauthorizedException("Missing or invalid metrics API key");
      }
    }

    return this.metricsService.getSnapshot();
  }
}
