import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE } from '../queue.constants';
import { AlertsWatcherService } from '../../alerts/alerts-watcher.service';

@Processor(QUEUE.alerts)
export class AlertProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertProcessor.name);

  constructor(private readonly watcher: AlertsWatcherService) {
    super();
  }

  async process(job: Job) {
    await this.watcher.tick();
    this.logger.debug(`alert job ${job.name}`);
  }
}
