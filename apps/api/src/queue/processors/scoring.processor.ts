import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { QUEUE } from '../queue.constants';
import { PrismaService } from '../../prisma/prisma.module';
import { WalletIngestService } from '../../smart-money/wallet-ingest.service';

@Processor(QUEUE.scoring)
export class ScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(ScoringProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingest: WalletIngestService,
    @InjectQueue(QUEUE.ai) private readonly ai: Queue,
  ) {
    super();
  }

  async process(_job: Job) {
    const wallets = await this.prisma.trackedWallet.findMany({
      where: { active: true },
      select: { id: true },
    });
    for (const w of wallets) {
      try {
        await this.ingest.refreshAnalytics(w.id);
      } catch (err) {
        this.logger.warn(`score wallet ${w.id}: ${(err as Error).message}`);
      }
    }

    const since = new Date(Date.now() - 30 * 60_000);
    const recent = await this.prisma.walletTrade.findFirst({
      where: { side: 'buy', createdAt: { gte: since }, coingeckoId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent?.coingeckoId) {
      try {
        await this.ai.add(
          'explain',
          { coingeckoId: recent.coingeckoId, symbol: recent.symbol },
          { delay: 500 },
        );
      } catch {
        /* duplicate / redis hiccup */
      }
    }
    this.logger.log(`scoring done (${wallets.length} wallets)`);
  }
}
