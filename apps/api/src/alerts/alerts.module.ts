import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsWatcherService } from './alerts-watcher.service';
import { SignalDetectorService } from './signal-detector.service';
import { MarketModule } from '../market/market.module';
import { TelegramModule } from '../telegram/telegram.module';
import { SmartMoneyModule } from '../smart-money/smart-money.module';
import { HoldersModule } from '../holders/holders.module';
import { RiskModule } from '../risk/risk.module';
import { ScoringModule } from '../scoring/scoring.module';
import { BacktestModule } from '../backtest/backtest.module';

@Module({
  imports: [
    MarketModule,
    TelegramModule,
    SmartMoneyModule,
    HoldersModule,
    RiskModule,
    ScoringModule,
    BacktestModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsWatcherService, SignalDetectorService],
  exports: [AlertsService, AlertsWatcherService],
})
export class AlertsModule {}
