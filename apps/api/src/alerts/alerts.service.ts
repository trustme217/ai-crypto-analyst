import { Injectable, NotFoundException } from '@nestjs/common';
import { StoreService } from '../store/store.service';
import { MarketService } from '../market/market.service';

@Injectable()
export class AlertsService {
  constructor(
    private readonly store: StoreService,
    private readonly market: MarketService,
  ) {}

  async list(userId: string) {
    const alerts = await this.store.listAlerts(userId);
    const enriched = await Promise.all(
      alerts.map(async (a) => {
        try {
          const coin = await this.market.getCoin(a.coingeckoId);
          const price = coin.market.price;
          const hit =
            a.active &&
            ((a.direction === 'above' && price >= a.targetPrice) ||
              (a.direction === 'below' && price <= a.targetPrice));
          return { ...a, currentPrice: price, status: hit ? 'triggered' : a.active ? 'watching' : 'off' };
        } catch {
          return { ...a, currentPrice: null, status: a.active ? 'watching' : 'off' };
        }
      }),
    );
    return { alerts: enriched };
  }

  async create(
    userId: string,
    data: { coingeckoId: string; direction: 'above' | 'below'; targetPrice: number },
  ) {
    const coin = await this.market.getCoin(data.coingeckoId);
    return this.store.createAlert({
      userId,
      coingeckoId: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      direction: data.direction,
      targetPrice: data.targetPrice,
    });
  }

  async remove(userId: string, id: string) {
    const ok = await this.store.removeAlert(userId, id);
    if (!ok) throw new NotFoundException('Alert not found');
    return { ok: true };
  }
}
