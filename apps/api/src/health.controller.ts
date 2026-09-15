import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  ok() {
    return { ok: true, service: 'ai-crypto-analyst-api', ts: new Date().toISOString() };
  }
}
