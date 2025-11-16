import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getStatus() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: true,
        database: 'pending-check',
        cache: 'pending-check',
      },
    };
  }
}
