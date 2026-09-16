import { Injectable, Logger } from '@nestjs/common';
import { StoreService } from '../store/store.service';
import { MarketService } from '../market/market.service';
import { TelegramService } from '../telegram/telegram.service';
import { SignalDetectorService } from './signal-detector.service';
import { BacktestService } from '../backtest/backtest.service';

@Injectable()
export class AlertsWatcherService {
  private readonly logger = new Logger(AlertsWatcherService.name);
  private running = false;

  constructor(
    private readonly store: StoreService,
    private readonly market: MarketService,
    private readonly telegram: TelegramService,
    private readonly detector: SignalDetectorService,
    private readonly backtest: BacktestService,
  ) {}

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const emitted = await this.detector.scan();
      if (emitted) this.logger.log(`Signal scan emitted ${emitted} event(s)`);
      await this.backtest.fillDue();
      await this.processPriceHits();
      if (this.telegram.isConfigured()) {
        await this.processRetries();
        await this.processSignalDeliveries();
      }
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

      await this.detector.emitPriceLevel({
        alertId: alert.id,
        coingeckoId: alert.coingeckoId,
        symbol: alert.symbol,
        name: alert.name,
        direction: alert.direction,
        targetPrice: alert.targetPrice,
        price,
      });

      const settings = await this.store.getSettings(alert.userId);
      if (!settings.telegramAlerts || !settings.telegramChatId?.trim()) {
        await this.store.markAlertTriggered(alert.id);
        continue;
      }

      const text = this.formatPriceMessage(
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
        this.logger.log(`Telegram PRICE alert sent for ${alert.symbol}`);
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
      const text = this.formatPriceMessage(
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

  private async processSignalDeliveries() {
    const due = await this.store.listDueSignalDeliveries(30);
    for (const delivery of due) {
      const settings = await this.store.getSettings(delivery.userId);
      if (!settings.telegramAlerts || !settings.telegramChatId?.trim()) {
        await this.store.markSignalDeliveryFailed(
          delivery.id,
          delivery.attempts + 1,
          'Telegram not configured',
        );
        continue;
      }
      try {
        await this.telegram.sendMessage(settings.telegramChatId, delivery.signal.body);
        await this.store.markSignalDeliverySent(delivery.id);
        this.logger.log(`Telegram ${delivery.signal.type} sent for ${delivery.signal.symbol}`);
      } catch (err) {
        await this.store.markSignalDeliveryFailed(
          delivery.id,
          delivery.attempts + 1,
          (err as Error).message,
        );
      }
    }
  }

  private formatPriceMessage(
    symbol: string,
    name: string,
    direction: string,
    target: number,
    price: number,
    coingeckoId: string,
  ) {
    return (
      `PRICE\n$${symbol} / ${name}\n` +
      `Price is ${direction} $${target}\n` +
      `Current: $${price}\n` +
      `CoinGecko: ${coingeckoId}`
    );
  }
}
