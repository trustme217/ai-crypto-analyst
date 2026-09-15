import { Module } from '@nestjs/common';
import { SignalsController } from './signals.controller';
import { SignalsService } from './signals.service';
import { MarketModule } from '../market/market.module';
import { ScoringModule } from '../scoring/scoring.module';
import { SmartMoneyModule } from '../smart-money/smart-money.module';

@Module({
  imports: [MarketModule, ScoringModule, SmartMoneyModule],
  controllers: [SignalsController],
  providers: [SignalsService],
})
export class SignalsModule {}
