import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

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
    winRate: 83,
    totalPnL: 610_000,
    totalTrades: 140,
    winningTrades: 116,
    losingTrades: 24,
    smartMoneyScore: 92,
    bestToken: 'BONK',
  },
] as const;

@Injectable()
export class SmartMoneyService implements OnModuleInit {
  private readonly logger = new Logger(SmartMoneyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSeed();
    // Lightweight continuous ingest stub — simulates recent buys for demos
    setInterval(() => void this.ingestStubTick(), 120_000);
    setTimeout(() => void this.ingestStubTick(), 8_000);
  }

  private async ensureSeed() {
    const count = await this.prisma.trackedWallet.count();
    if (count > 0) return;
    this.logger.log('Seeding tracked smart-money wallets…');
    for (const w of SEED_WALLETS) {
      await this.prisma.trackedWallet.create({
        data: {
          address: w.address,
          chain: 'solana',
          label: w.label,
          winRate: w.winRate,
          totalPnL: w.totalPnL,
          totalTrades: w.totalTrades,
          winningTrades: w.winningTrades,
          losingTrades: w.losingTrades,
          averagePnL: w.totalPnL / Math.max(1, w.totalTrades),
          maxProfit: w.totalPnL * 0.15,
          maxDrawdown: -Math.abs(w.totalPnL) * 0.08,
          averageHoldTime: 36,
          bestToken: w.bestToken,
          smartMoneyScore: w.smartMoneyScore,
          active: true,
        },
      });
    }
  }

  /** Demo ingest: random buy among seeded wallets on majors. */
  async ingestStubTick() {
    try {
      const wallets = await this.prisma.trackedWallet.findMany({ where: { active: true }, take: 10 });
      if (!wallets.length) return;
      const picks = [
        { symbol: 'SOL', coingeckoId: 'solana' },
        { symbol: 'BTC', coingeckoId: 'bitcoin' },
        { symbol: 'ETH', coingeckoId: 'ethereum' },
        { symbol: 'JUP', coingeckoId: 'jupiter-exchange-solana' },
        { symbol: 'BONK', coingeckoId: 'bonk' },
      ];
      // 1–3 wallets buy the same token in this tick window
      const asset = picks[Math.floor(Math.random() * picks.length)];
      const n = 1 + Math.floor(Math.random() * Math.min(3, wallets.length));
      const shuffled = [...wallets].sort(() => Math.random() - 0.5).slice(0, n);
      for (const w of shuffled) {
        await this.prisma.walletTrade.create({
          data: {
            walletId: w.id,
            coingeckoId: asset.coingeckoId,
            mintOrSymbol: asset.symbol,
            symbol: asset.symbol,
            side: 'buy',
            notionalUsd: 5_000 + Math.random() * 40_000,
            blockTime: new Date(),
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Wallet ingest stub failed: ${(err as Error).message}`);
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
      })),
    };
  }

  /** Smart-money score for a token from recent tracked buys (window minutes). */
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
}
