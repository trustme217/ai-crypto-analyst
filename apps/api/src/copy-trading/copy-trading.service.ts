import { Injectable, NotFoundException } from '@nestjs/common';
import { StoreService } from '../store/store.service';

const LEADERS = [
  {
    id: 'nova-sol',
    name: 'Nova Sol Desk',
    style: 'momentum',
    winRate: 61,
    avgReturn30d: 12.4,
    followers: 1840,
    risk: 'medium',
    focus: ['SOL', 'JUP', 'BONK'],
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
    bio: 'High-beta alt breakouts. Paper-copy only in this MVP.',
  },
];

@Injectable()
export class CopyTradingService {
  constructor(private readonly store: StoreService) {}

  leaders() {
    return {
      disclaimer: 'Demo copy-trading leaders. No real funds are moved in this MVP.',
      leaders: LEADERS,
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
}
