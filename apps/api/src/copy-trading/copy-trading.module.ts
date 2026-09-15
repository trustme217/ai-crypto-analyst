import { Module } from '@nestjs/common';
import { CopyTradingController } from './copy-trading.controller';
import { CopyTradingService } from './copy-trading.service';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [MarketModule],
  controllers: [CopyTradingController],
  providers: [CopyTradingService],
})
export class CopyTradingModule {}
