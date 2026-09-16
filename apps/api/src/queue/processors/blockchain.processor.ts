import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { QUEUE } from '../queue.constants';
import { WalletIngestService } from '../../smart-money/wallet-ingest.service';

@Processor(QUEUE.blockchain)
export class BlockchainProcessor extends WorkerHost {
  private readonly logger = new Logger(BlockchainProcessor.name);

  constructor(
    private readonly ingest: WalletIngestService,
    @InjectQueue(QUEUE.scoring) private readonly scoring: Queue,
  ) {
    super();
  }

  async process(job: Job) {
    this.logger.log(`blockchain job ${job.name}`);
    await this.ingest.ingestTick();
    await this.scoring.add('after-ingest', { at: new Date().toISOString(), source: job.name });
  }
}
