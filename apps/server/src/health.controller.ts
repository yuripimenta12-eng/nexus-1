import { Controller, Get } from '@nestjs/common';

// Endpoint usado pelo health check do Railway (/api/health)
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', uptime: process.uptime() };
  }
}
