import { Injectable, NotFoundException } from '@nestjs/common';
import { StoreService } from '../store/store.service';
import { MarketService } from '../market/market.service';
import { TelegramService } from '../telegram/telegram.service';
import { AlertsWatcherService } from './alerts-watcher.service';
import { SIGNAL_TYPES } from './signal.types';

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
      types: this.types().types,
      telegram: {
        botConfigured: this.telegram.isConfigured(),
        pollHint:
          'Alert queue is signal-driven: SMART_MONEY_BUY, TOKEN_SCORE_CHANGE, WHALE_ACTIVITY, LIQUIDITY_DROP, RISK_CHANGE, AI_SIGNAL, PRICE, VOLUME → Telegram (retries kept).',
      },
    };
  }

  types() {
    return { types: [...SIGNAL_TYPES] };
  }

  async recentSignals() {
    const signals = await this.store.listRecentSignals(40);
    return {
      types: this.types().types,
      signals: signals.map((s) => ({
        ...s,
        payload: JSON.parse(s.payloadJson || '{}') as Record<string, unknown>,
      })),
    };
  }

  async scan() {
    await this.watcher.tick();
    const feed = await this.recentSignals();
    return { ok: true, types: feed.types, signals: feed.signals };
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
