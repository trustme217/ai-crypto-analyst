import { Module } from '@nestjs/common';
import { RiskEngineService } from './risk-engine.service';
import { RiskController } from './risk.controller';
import { HoldersModule } from '../holders/holders.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [HoldersModule, MarketModule],
  controllers: [RiskController],
  providers: [RiskEngineService],
  exports: [RiskEngineService],
})
export class RiskModule {}
