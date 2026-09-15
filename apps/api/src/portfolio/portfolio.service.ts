import { Injectable, NotFoundException } from '@nestjs/common';
import { StoreService } from '../store/store.service';
import { MarketService } from '../market/market.service';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly store: StoreService,
    private readonly market: MarketService,
  ) {}

  async list(userId: string) {
    const rows = await this.store.listPortfolio(userId);
    const positions = await Promise.all(
      rows.map(async (p) => {
        try {
          const coin = await this.market.getCoin(p.coingeckoId);
          const price = coin.market.price;
          const marketValue = price * p.quantity;
          const cost = p.avgCostUsd * p.quantity;
          const pnl = marketValue - cost;
          const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
          return {
            ...p,
            price,
            marketValue,
            cost,
            pnl,
            pnlPct,
            change24h: coin.market.change24h,
            image: coin.image,
          };
        } catch {
          return {
            ...p,
            price: null,
            marketValue: null,
            cost: p.avgCostUsd * p.quantity,
            pnl: null,
            pnlPct: null,
            change24h: null,
            image: null,
          };
        }
      }),
    );

    const totals = positions.reduce(
      (acc, p) => {
        acc.marketValue += p.marketValue || 0;
        acc.cost += p.cost || 0;
        return acc;
      },
      { marketValue: 0, cost: 0 },
    );

    return {
      positions,
      summary: {
        marketValue: totals.marketValue,
        cost: totals.cost,
        pnl: totals.marketValue - totals.cost,
        pnlPct: totals.cost > 0 ? ((totals.marketValue - totals.cost) / totals.cost) * 100 : 0,
        count: positions.length,
      },
    };
  }

  async add(
    userId: string,
    data: { coingeckoId: string; quantity: number; avgCostUsd: number },
  ) {
    const coin = await this.market.getCoin(data.coingeckoId);
    return this.store.upsertPortfolio({
      userId,
      coingeckoId: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      quantity: data.quantity,
      avgCostUsd: data.avgCostUsd,
    });
  }

  async remove(userId: string, id: string) {
    const ok = await this.store.removePortfolio(userId, id);
    if (!ok) throw new NotFoundException('Position not found');
    return { ok: true };
  }
}
