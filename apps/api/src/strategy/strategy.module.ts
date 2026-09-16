import { Module } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { StrategyController } from './strategy.controller';
import { SmartMoneyModule } from '../smart-money/smart-money.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [SmartMoneyModule, MarketModule],
  controllers: [StrategyController],
  providers: [StrategyService],
  exports: [StrategyService],
})
export class StrategyModule {}
