import { Module } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { StrategyController } from './strategy.controller';
import { SmartMoneyModule } from '../smart-money/smart-money.module';

@Module({
  imports: [SmartMoneyModule],
  controllers: [StrategyController],
  providers: [StrategyService],
  exports: [StrategyService],
})
export class StrategyModule {}
