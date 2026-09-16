import { Controller, Get, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PIPELINE, QUEUE } from './queue.constants';

@Controller('queue')
export class QueueController {
  constructor(
    @InjectQueue(QUEUE.blockchain) private readonly blockchain: Queue,
    @InjectQueue(QUEUE.scoring) private readonly scoring: Queue,
    @InjectQueue(QUEUE.ai) private readonly ai: Queue,
    @InjectQueue(QUEUE.alerts) private readonly alerts: Queue,
  ) {}

  @Get()
  async status() {
    const counts = async (q: Queue) => q.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed');
    return {
      pipeline: [...PIPELINE],
      redis: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
      queues: {
        blockchain: await counts(this.blockchain),
        scoring: await counts(this.scoring),
        ai: await counts(this.ai),
        alerts: await counts(this.alerts),
      },
    };
  }

  @Post('tick')
  async tick() {
    const job = await this.blockchain.add('tick', { source: 'manual' });
    return { ok: true, jobId: job.id, queued: QUEUE.blockchain };
  }
}
