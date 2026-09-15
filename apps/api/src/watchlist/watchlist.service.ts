import { Injectable, NotFoundException } from '@nestjs/common';
import { StoreService } from '../store/store.service';
import { MarketService } from '../market/market.service';

@Injectable()
export class WatchlistService {
  constructor(
    private readonly store: StoreService,
    private readonly market: MarketService,
  ) {}

  async list(userId: string) {
    const items = await this.store.listWatchlist(userId);
    return { items };
  }

  async add(userId: string, coingeckoId: string) {
    const coin = await this.market.getCoin(coingeckoId);
    return this.store.upsertWatchlist({
      userId,
      coingeckoId: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
    });
  }

  async remove(userId: string, coingeckoId: string) {
    const ok = await this.store.removeWatchlist(userId, coingeckoId);
    if (!ok) throw new NotFoundException('Watchlist item not found');
    return { ok: true };
  }
}
