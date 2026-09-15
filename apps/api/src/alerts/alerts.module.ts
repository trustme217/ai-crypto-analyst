import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsWatcherService } from './alerts-watcher.service';
import { MarketModule } from '../market/market.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [MarketModule, TelegramModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsWatcherService],
  exports: [AlertsService, AlertsWatcherService],
})
export class AlertsModule {}
