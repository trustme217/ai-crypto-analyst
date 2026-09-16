import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { MarketModule } from '../market/market.module';
import { HoldersModule } from '../holders/holders.module';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [MarketModule, HoldersModule, RiskModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
