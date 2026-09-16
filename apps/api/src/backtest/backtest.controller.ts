import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { OptionalJwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimitGuard } from '../common/rate-limit.guard';

@Controller('backtest')
export class BacktestController {
  constructor(private readonly backtest: BacktestService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  summary() {
    return this.backtest.summary();
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('signals')
  list(@Query('limit') limit?: string) {
    return this.backtest.list(limit ? Number(limit) : 50);
  }

  @UseGuards(OptionalJwtAuthGuard, RateLimitGuard(8, 60_000))
  @Post('fill')
  async fill() {
    const filled = await this.backtest.fillDue();
    const summary = await this.backtest.summary();
    return { ok: true, filled, ...summary };
  }
}
