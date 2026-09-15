import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StoreService } from '../store/store.service';
import { MarketService } from '../market/market.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class AlertsWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertsWatcherService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly store: StoreService,
    private readonly market: MarketService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const seconds = Math.max(20, Number(this.config.get('ALERT_POLL_SECONDS') || 60));
    this.logger.log(
      `Alert watcher started (every ${seconds}s)` +
        (this.telegram.isConfigured() ? '' : ' — TELEGRAM_BOT_TOKEN missing'),
    );
    void this.tick();
    this.timer = setInterval(() => void this.tick(), seconds * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      if (!this.telegram.isConfigured()) return;
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
          this.logger.debug?.(
            `Alert ${alert.symbol} hit but Telegram not enabled/configured for user ${alert.userId}`,
          );
          continue;
        }

        const text =
          `ACA Alert: ${alert.symbol} (${alert.name})\n` +
          `Price is ${alert.direction} $${alert.targetPrice}\n` +
          `Current: $${price}\n` +
          `CoinGecko: ${alert.coingeckoId}`;

        try {
          await this.telegram.sendMessage(settings.telegramChatId, text);
          await this.store.markAlertTriggered(alert.id);
          this.logger.log(`Telegram alert sent for ${alert.symbol} → ${settings.telegramChatId}`);
        } catch (err) {
          this.logger.warn(
            `Failed to notify Telegram for ${alert.id}: ${(err as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(`Alert watcher tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
