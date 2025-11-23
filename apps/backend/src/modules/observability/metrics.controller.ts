import { Controller, Get, Header, Headers, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service.js';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService, private readonly configService: ConfigService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async metrics(@Headers('x-api-key') apiKey?: string): Promise<string> {
    const metricsApiKey = this.configService.get<string>('METRICS_API_KEY');
    const environment = this.configService.get<string>('NODE_ENV') ?? 'development';

    if (environment !== 'development' && metricsApiKey) {
      const provided = apiKey ?? this.configService.get<string>('METRICS_TOKEN') ?? process.env.METRICS_TOKEN;
      if (provided !== metricsApiKey) {
        throw new UnauthorizedException('Missing or invalid metrics API key');
      }
    }

    return this.metricsService.getSnapshot();
  }
}
