import { Controller, Get, Post, Query } from '@nestjs/common';
import { SmartMoneyService } from './smart-money.service';

@Controller('smart-money')
export class SmartMoneyController {
  constructor(private readonly smart: SmartMoneyService) {}

  @Get('wallets')
  wallets() {
    return this.smart.listWallets();
  }

  @Get('signals')
  signals(@Query('window') window?: string) {
    const mins = Math.min(240, Math.max(5, Number(window) || 30));
    return this.smart.recentSignals(mins);
  }

  @Get('events')
  events(@Query('limit') limit?: string) {
    const n = Math.min(100, Math.max(5, Number(limit) || 40));
    return this.smart.recentEvents(n);
  }

  @Post('ingest')
  async ingest() {
    const job = await this.smart.triggerIngest();
    return { ok: true, queued: true, jobId: job.id, message: 'Queued on blockchain → scoring → AI → alerts' };
  }
}
