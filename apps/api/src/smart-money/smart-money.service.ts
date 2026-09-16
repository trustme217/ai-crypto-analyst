import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.module';
import { WalletIngestService } from './wallet-ingest.service';
import { QUEUE } from '../queue/queue.constants';

export type SmartMoneySignal = {
  symbol: string;
  coingeckoId: string | null;
  score: number;
  summary: string;
  wallets: Array<{
    label: string | null;
    address: string;
    winRate: number;
    totalPnL: number;
    smartMoneyScore: number;
    side: string;
    at: string;
  }>;
  windowMinutes: number;
  generatedAt: string;
};

const SEED_WALLETS = [
  {
    address: 'NovaSm1tWallet11111111111111111111111111111',
    label: 'Wallet A',
    source: 'demo' as const,
    winRate: 78,
    totalPnL: 420_000,
    totalTrades: 120,
    winningTrades: 94,
    losingTrades: 26,
    smartMoneyScore: 88,
    bestToken: 'SOL',
  },
  {
    address: 'AtlasSm2Wallet2222222222222222222222222222',
    label: 'Wallet B',
    source: 'demo' as const,
    winRate: 71,
    totalPnL: 180_000,
    totalTrades: 95,
    winningTrades: 67,
    losingTrades: 28,
    smartMoneyScore: 76,
    bestToken: 'JUP',
  },
  {
    address: 'PulseSm3Wallet3333333333333333333333333333',
    label: 'Wallet C',
    source: 'demo' as const,
    winRate: 83,
    totalPnL: 610_000,
    totalTrades: 140,
    winningTrades: 116,
    losingTrades: 24,
    smartMoneyScore: 92,
    bestToken: 'BONK',
  },
  // Live RPC ingest examples (public high-activity accounts)
  {
    address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    label: 'Exchange hot (RPC)',
    source: 'rpc' as const,
    winRate: 0,
    totalPnL: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    smartMoneyScore: 50,
    bestToken: null as string | null,
  },
  {
    address: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    label: 'Raydium auth (RPC)',
    source: 'rpc' as const,
    winRate: 0,
    totalPnL: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    smartMoneyScore: 50,
    bestToken: null as string | null,
  },
] as const;

@Injectable()
export class SmartMoneyService implements OnModuleInit {
  private readonly logger = new Logger(SmartMoneyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingest: WalletIngestService,
    @InjectQueue(QUEUE.blockchain) private readonly blockchain: Queue,
  ) {}

  async onModuleInit() {
    await this.ensureSeed();
    this.logger.log('Wallet ingest is queue-driven (BullMQ blockchain queue)');
  }

  private async ensureSeed() {
    for (const w of SEED_WALLETS) {
      const existing = await this.prisma.trackedWallet.findUnique({
        where: { chain_address: { chain: 'solana', address: w.address } },
      });
      if (existing) {
        if (existing.source !== w.source || existing.label !== w.label) {
          await this.prisma.trackedWallet.update({
            where: { id: existing.id },
            data: { source: w.source, label: w.label },
          });
        }
        continue;
      }
      this.logger.log(`Seeding tracked wallet ${w.label}…`);
      await this.prisma.trackedWallet.create({
        data: {
          address: w.address,
          chain: 'solana',
          label: w.label,
          source: w.source,
          winRate: w.winRate,
          totalPnL: w.totalPnL,
          totalTrades: w.totalTrades,
          winningTrades: w.winningTrades,
          losingTrades: w.losingTrades,
          averagePnL: w.totalTrades ? w.totalPnL / w.totalTrades : 0,
          maxProfit: w.totalPnL * 0.15,
          maxDrawdown: -Math.abs(w.totalPnL) * 0.08,
          averageHoldTime: w.source === 'demo' ? 36 : 0,
          bestToken: w.bestToken,
          smartMoneyScore: w.smartMoneyScore,
          active: true,
        },
      });
    }
  }

  async listWallets() {
    const wallets = await this.prisma.trackedWallet.findMany({
      where: { active: true },
      orderBy: { smartMoneyScore: 'desc' },
    });
    return {
      wallets: wallets.map((w) => ({
        id: w.id,
        address: w.address,
        chain: w.chain,
        label: w.label,
        source: w.source,
        totalTrades: w.totalTrades,
        winningTrades: w.winningTrades,
        losingTrades: w.losingTrades,
        winRate: w.winRate,
        totalPnL: w.totalPnL,
        averagePnL: w.averagePnL,
        maxProfit: w.maxProfit,
        maxDrawdown: w.maxDrawdown,
        averageHoldTime: w.averageHoldTime,
        bestToken: w.bestToken,
        worstToken: w.worstToken,
        smartMoneyScore: w.smartMoneyScore,
        lastIngestAt: w.lastIngestAt?.toISOString() ?? null,
        lastSignature: w.lastSignature,
      })),
    };
  }

  async scoreForSymbol(symbol: string, windowMinutes = 60): Promise<number | null> {
    const since = new Date(Date.now() - windowMinutes * 60_000);
    const trades = await this.prisma.walletTrade.findMany({
      where: {
        symbol: symbol.toUpperCase(),
        side: 'buy',
        createdAt: { gte: since },
      },
      include: { wallet: true },
    });
    if (!trades.length) return null;
    const uniq = new Map<string, number>();
    for (const t of trades) {
      if (!t.wallet.active) continue;
      uniq.set(t.walletId, t.wallet.smartMoneyScore);
    }
    if (!uniq.size) return null;
    const scores = [...uniq.values()];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const crowdBoost = Math.min(15, (uniq.size - 1) * 6);
    return Math.round(Math.min(100, avg + crowdBoost));
  }

  async recentSignals(windowMinutes = 30): Promise<{ signals: SmartMoneySignal[] }> {
    const since = new Date(Date.now() - windowMinutes * 60_000);
    const trades = await this.prisma.walletTrade.findMany({
      where: { side: 'buy', createdAt: { gte: since } },
      include: { wallet: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const bySymbol = new Map<string, typeof trades>();
    for (const t of trades) {
      if (!t.wallet.active) continue;
      const key = t.symbol.toUpperCase();
      if (!bySymbol.has(key)) bySymbol.set(key, []);
      bySymbol.get(key)!.push(t);
    }

    const signals: SmartMoneySignal[] = [];
    for (const [symbol, list] of bySymbol) {
      const seen = new Map<string, (typeof list)[number]>();
      for (const t of list) {
        if (!seen.has(t.walletId)) seen.set(t.walletId, t);
      }
      if (seen.size < 1) continue;
      const wallets = [...seen.values()].map((t) => ({
        label: t.wallet.label,
        address: t.wallet.address,
        winRate: t.wallet.winRate,
        totalPnL: t.wallet.totalPnL,
        smartMoneyScore: t.wallet.smartMoneyScore,
        side: t.side,
        at: t.createdAt.toISOString(),
      }));
      const score =
        (await this.scoreForSymbol(symbol, windowMinutes)) ??
        Math.round(wallets.reduce((s, w) => s + w.smartMoneyScore, 0) / wallets.length);
      signals.push({
        symbol,
        coingeckoId: list[0]?.coingeckoId || null,
        score,
        summary: `${wallets.length} tracked high-performing wallet${wallets.length === 1 ? '' : 's'} bought ${symbol} within ${windowMinutes} minutes.`,
        wallets,
        windowMinutes,
        generatedAt: new Date().toISOString(),
      });
    }

    signals.sort((a, b) => b.score - a.score || b.wallets.length - a.wallets.length);
    return { signals };
  }

  recentEvents(limit = 40) {
    return this.ingest.recentEvents(limit);
  }

  triggerIngest() {
    return this.blockchain.add('tick', { source: 'manual' });
  }
}
