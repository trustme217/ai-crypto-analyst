import { Module } from '@nestjs/common';
import { SignalsController } from './signals.controller';
import { SignalsService } from './signals.service';
import { MarketModule } from '../market/market.module';
import { ScoringModule } from '../scoring/scoring.module';
import { SmartMoneyModule } from '../smart-money/smart-money.module';
import { HoldersModule } from '../holders/holders.module';
import { RiskModule } from '../risk/risk.module';
import { BacktestModule } from '../backtest/backtest.module';

@Module({
  imports: [MarketModule, ScoringModule, SmartMoneyModule, HoldersModule, RiskModule, BacktestModule],
  controllers: [SignalsController],
  providers: [SignalsService],
})
export class SignalsModule {}
