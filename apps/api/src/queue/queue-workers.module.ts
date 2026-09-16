import { Module } from '@nestjs/common';
import { RedisBullModule } from './redis-bull.module';
import { QueueSchedulerService } from './queue-scheduler.service';
import { QueueController } from './queue.controller';
import { BlockchainProcessor } from './processors/blockchain.processor';
import { ScoringProcessor } from './processors/scoring.processor';
import { AiProcessor } from './processors/ai.processor';
import { AlertProcessor } from './processors/alert.processor';
import { SmartMoneyModule } from '../smart-money/smart-money.module';
import { AlertsModule } from '../alerts/alerts.module';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [RedisBullModule, SmartMoneyModule, AlertsModule, AnalysisModule],
  controllers: [QueueController],
  providers: [
    QueueSchedulerService,
    BlockchainProcessor,
    ScoringProcessor,
    AiProcessor,
    AlertProcessor,
  ],
})
export class QueueWorkersModule {}
