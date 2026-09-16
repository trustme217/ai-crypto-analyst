import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PIPELINE, QUEUE } from './queue.constants';

@Injectable()
export class QueueSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(QueueSchedulerService.name);

  constructor(
    @InjectQueue(QUEUE.blockchain) private readonly blockchain: Queue,
    @InjectQueue(QUEUE.alerts) private readonly alerts: Queue,
  ) {}

  async onModuleInit() {
    await this.blockchain.upsertJobScheduler(
      'blockchain-tick',
      { every: 90_000 },
      { name: 'tick', data: { repeat: true } },
    );
    await this.alerts.upsertJobScheduler(
      'alerts-poll',
      { every: 60_000 },
      { name: 'poll', data: { repeat: true } },
    );
    await this.blockchain.add('tick', { source: 'startup' }, { delay: 4_000 });
    this.logger.log(`BullMQ pipeline: ${PIPELINE.join(' → ')}`);
  }
}
