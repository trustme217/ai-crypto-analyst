import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { QUEUE } from '../queue.constants';
import { AnalysisService } from '../../analysis/analysis.service';

@Processor(QUEUE.ai)
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(
    private readonly analysis: AnalysisService,
    @InjectQueue(QUEUE.alerts) private readonly alerts: Queue,
  ) {
    super();
  }

  async process(job: Job<{ coingeckoId?: string; symbol?: string }>) {
    const id = job.data?.coingeckoId;
    if (id) {
      try {
        await this.analysis.analyze(id);
        this.logger.log(`AI explained ${job.data.symbol || id}`);
      } catch (err) {
        this.logger.warn(`AI job skipped: ${(err as Error).message}`);
      }
    }
    await this.alerts.add('poll', { reason: 'after-ai' });
  }
}
