import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { StoreService } from '../store/store.service';
import { MarketService } from '../market/market.service';

export const LEADERS = [
  {
    id: 'nova-sol',
    name: 'Nova Sol Desk',
    style: 'momentum',
    winRate: 61,
    avgReturn30d: 12.4,
    followers: 1840,
    risk: 'medium',
    focus: ['SOL', 'JUP', 'BONK'],
    focusIds: ['solana', 'jupiter-exchange-solana', 'bonk'],
    bio: 'Solana momentum rotation with tight invalidation levels.',
  },
  {
    id: 'atlas-macro',
    name: 'Atlas Macro',
    style: 'swing',
    winRate: 57,
    avgReturn30d: 8.1,
    followers: 3120,
    risk: 'low',
    focus: ['BTC', 'ETH', 'SOL'],
    focusIds: ['bitcoin', 'ethereum', 'solana'],
    bio: 'Macro-aware swing book; slower cadence, lower drawdown.',
  },
  {
    id: 'pulse-alt',
    name: 'Pulse Alts',
    style: 'aggressive',
    winRate: 52,
    avgReturn30d: 18.7,
    followers: 960,
    risk: 'high',
    focus: ['LINK', 'AVAX', 'NEAR'],
    focusIds: ['chainlink', 'avalanche-2', 'near'],
    bio: 'High-beta alt breakouts. Paper-copy only in this MVP.',
  },
] as const;

@Injectable()
export class CopyTradingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CopyTradingService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly store: StoreService,
    private readonly market: MarketService,
  ) {}

  onModuleInit() {
    // Simulate paper fills every ~3 minutes
    this.timer = setInterval(() => void this.simulateOnce(), 180_000);
    setTimeout(() => void this.simulateOnce(), 15_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  leaders() {
    return {
      disclaimer:
        'Paper copy-trading desks. Simulated fills may appear in your paper book — no real funds move.',
      leaders: LEADERS.map(({ focusIds: _f, ...rest }) => rest),
    };
  }

  async myFollows(userId: string) {
    const follows = await this.store.listCopyFollows(userId);
    return {
      follows: follows.map((f) => ({
        ...f,
        trader: LEADERS.find((l) => l.id === f.traderId) || null,
      })),
    };
  }

  async recentTrades(userId: string) {
    const trades = await this.store.listCopyPaperTrades(userId, 40);
    return { trades };
  }

  async follow(userId: string, traderId: string, allocationPct: number) {
    if (!LEADERS.some((l) => l.id === traderId)) {
      throw new NotFoundException('Trader not found');
    }
    return this.store.followTrader(userId, traderId, allocationPct);
  }

  async unfollow(userId: string, traderId: string) {
    const ok = await this.store.unfollowTrader(userId, traderId);
    if (!ok) throw new NotFoundException('Follow not found');
    return { ok: true };
  }

  async simulateOnce() {
    if (this.running) return;
    this.running = true;
    try {
      const follows = await this.store.listAllActiveCopyFollows();
      if (!follows.length) return;

      for (const follow of follows) {
        // ~40% chance per tick to skip this follow (slower desks)
        if (Math.random() > 0.55) continue;
        const leader = LEADERS.find((l) => l.id === follow.traderId);
        if (!leader) continue;

        const coinId = leader.focusIds[Math.floor(Math.random() * leader.focusIds.length)];
        let coin;
        try {
          coin = await this.market.getCoin(coinId);
        } catch {
          continue;
        }
        const price = coin.market.price;
        if (!price || price <= 0) continue;

        const notional = Math.max(25, (follow.allocationPct / 100) * 1000 * (0.4 + Math.random() * 0.8));
        const side = Math.random() > 0.35 ? 'buy' : 'sell';
        const quantity = Number((notional / price).toFixed(6));

        await this.store.createCopyPaperTrade({
          userId: follow.userId,
          traderId: leader.id,
          coingeckoId: coin.id,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          side,
          quantity,
          priceUsd: price,
          notionalUsd: notional,
          note: `Paper fill from ${leader.name}`,
        });

        // Mirror into paper portfolio on buys; reduce on sells when possible
        const positions = await this.store.listPortfolio(follow.userId);
        const existing = positions.find((p) => p.coingeckoId === coin.id);
        if (side === 'buy') {
          const newQty = (existing?.quantity || 0) + quantity;
          const cost =
            ((existing?.quantity || 0) * (existing?.avgCostUsd || 0) + notional) / (newQty || 1);
          await this.store.upsertPortfolio({
            userId: follow.userId,
            coingeckoId: coin.id,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            quantity: newQty,
            avgCostUsd: cost,
          });
        } else if (existing && existing.quantity > 0) {
          const sellQty = Math.min(existing.quantity, quantity);
          const remain = existing.quantity - sellQty;
          if (remain <= 1e-8) {
            await this.store.removePortfolio(follow.userId, existing.id);
          } else {
            await this.store.upsertPortfolio({
              userId: follow.userId,
              coingeckoId: coin.id,
              symbol: existing.symbol,
              name: existing.name,
              quantity: remain,
              avgCostUsd: existing.avgCostUsd,
            });
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Copy sim tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
