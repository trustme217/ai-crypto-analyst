import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { RiskModule } from '../risk/risk.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AgentsModule, RiskModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
