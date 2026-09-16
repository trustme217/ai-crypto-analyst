import { Injectable, Logger } from '@nestjs/common';
import { StoreService } from '../store/store.service';
import { MarketService } from '../market/market.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class AlertsWatcherService {
  private readonly logger = new Logger(AlertsWatcherService.name);
  private running = false;

  constructor(
    private readonly store: StoreService,
    private readonly market: MarketService,
    private readonly telegram: TelegramService,
  ) {}


  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      if (!this.telegram.isConfigured()) return;
      await this.processPriceHits();
      await this.processRetries();
    } catch (err) {
      this.logger.warn(`Alert watcher tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async processPriceHits() {
    const alerts = await this.store.listActiveAlerts();
    if (!alerts.length) return;

    const ids = [...new Set(alerts.map((a) => a.coingeckoId))];
    const prices = await this.market.getSimplePrices(ids);

    for (const alert of alerts) {
      const price = prices[alert.coingeckoId];
      if (price == null) continue;

      const hit =
        (alert.direction === 'above' && price >= alert.targetPrice) ||
        (alert.direction === 'below' && price <= alert.targetPrice);
      if (!hit) continue;

      const settings = await this.store.getSettings(alert.userId);
      if (!settings.telegramAlerts || !settings.telegramChatId?.trim()) {
        continue;
      }

      const text = this.formatMessage(alert.symbol, alert.name, alert.direction, alert.targetPrice, price, alert.coingeckoId);
      try {
        await this.telegram.sendMessage(settings.telegramChatId, text);
        await this.store.markAlertTriggered(alert.id);
        this.logger.log(`Telegram alert sent for ${alert.symbol}`);
      } catch (err) {
        await this.store.enqueueAlertDelivery(alert.id, (err as Error).message);
        this.logger.warn(`Queued retry for ${alert.id}: ${(err as Error).message}`);
      }
    }
  }

  private async processRetries() {
    const due = await this.store.listDueDeliveries(20);
    for (const delivery of due) {
      const alert = delivery.alert;
      if (!alert || alert.triggeredAt) {
        await this.store.markDeliverySent(delivery.id);
        continue;
      }
      const settings = await this.store.getSettings(alert.userId);
      if (!settings.telegramAlerts || !settings.telegramChatId?.trim()) {
        await this.store.markDeliveryFailed(delivery.id, delivery.attempts + 1, 'Telegram not configured');
        continue;
      }
      let price = alert.targetPrice;
      try {
        const prices = await this.market.getSimplePrices([alert.coingeckoId]);
        if (prices[alert.coingeckoId] != null) price = prices[alert.coingeckoId];
      } catch {
        /* use target as fallback in message */
      }
      const text = this.formatMessage(
        alert.symbol,
        alert.name,
        alert.direction,
        alert.targetPrice,
        price,
        alert.coingeckoId,
      );
      try {
        await this.telegram.sendMessage(settings.telegramChatId, text);
        await this.store.markAlertTriggered(alert.id);
        await this.store.markDeliverySent(delivery.id);
        this.logger.log(`Telegram retry succeeded for ${alert.symbol}`);
      } catch (err) {
        await this.store.markDeliveryFailed(delivery.id, delivery.attempts + 1, (err as Error).message);
      }
    }
  }

  private formatMessage(
    symbol: string,
    name: string,
    direction: string,
    target: number,
    price: number,
    coingeckoId: string,
  ) {
    return (
      `ACA Alert: ${symbol} (${name})\n` +
      `Price is ${direction} $${target}\n` +
      `Current: $${price}\n` +
      `CoinGecko: ${coingeckoId}`
    );
  }
}
