import { Injectable, NotFoundException } from '@nestjs/common';
import { StoreService } from '../store/store.service';
import { MarketService } from '../market/market.service';
import { TelegramService } from '../telegram/telegram.service';
import { AlertsWatcherService } from './alerts-watcher.service';

@Injectable()
export class AlertsService {
  constructor(
    private readonly store: StoreService,
    private readonly market: MarketService,
    private readonly telegram: TelegramService,
    private readonly watcher: AlertsWatcherService,
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
            !a.triggeredAt &&
            ((a.direction === 'above' && price >= a.targetPrice) ||
              (a.direction === 'below' && price <= a.targetPrice));
          return {
            ...a,
            currentPrice: price,
            status: a.triggeredAt ? 'sent' : hit ? 'triggered' : a.active ? 'watching' : 'off',
            telegramReady: this.telegram.isConfigured(),
          };
        } catch {
          return {
            ...a,
            currentPrice: null,
            status: a.triggeredAt ? 'sent' : a.active ? 'watching' : 'off',
            telegramReady: this.telegram.isConfigured(),
          };
        }
      }),
    );
    return {
      alerts: enriched,
      telegram: {
        botConfigured: this.telegram.isConfigured(),
        pollHint: 'Background watcher checks prices and sends Telegram when a level is hit.',
      },
    };
  }

  async create(
    userId: string,
    data: { coingeckoId: string; direction: 'above' | 'below'; targetPrice: number },
  ) {
    const coin = await this.market.getCoin(data.coingeckoId);
    const alert = await this.store.createAlert({
      userId,
      coingeckoId: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      direction: data.direction,
      targetPrice: data.targetPrice,
    });
    // Immediate check so already-hit levels notify without waiting for the next poll
    void this.watcher.tick();
    return alert;
  }

  async remove(userId: string, id: string) {
    const ok = await this.store.removeAlert(userId, id);
    if (!ok) throw new NotFoundException('Alert not found');
    return { ok: true };
  }
}
