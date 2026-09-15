import { Controller, Get, Query } from '@nestjs/common';
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
}
