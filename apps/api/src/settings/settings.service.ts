import { Injectable, BadRequestException } from '@nestjs/common';
import { StoreService, UserSettings } from '../store/store.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly store: StoreService,
    private readonly telegram: TelegramService,
  ) {}

  async get(userId: string) {
    const s = await this.store.getSettings(userId);
    let botUsername: string | null = null;
    if (this.telegram.isConfigured()) {
      try {
        const me = await this.telegram.getMe();
        botUsername = me.username || null;
      } catch {
        botUsername = null;
      }
    }
    return {
      ...s,
      telegramBotConfigured: this.telegram.isConfigured(),
      telegramBotUsername: botUsername,
      telegramBotOk: Boolean(botUsername),
    };
  }

  update(userId: string, patch: Partial<Omit<UserSettings, 'userId' | 'updatedAt'>>) {
    const normalized = { ...patch };
    if (typeof normalized.telegramChatId === 'string') {
      const trimmed = normalized.telegramChatId.trim();
      normalized.telegramChatId = trimmed || null;
    }
    return this.store.updateSettings(userId, normalized);
  }

  async testTelegram(userId: string, chatIdFromClient?: string) {
    if (!this.telegram.isConfigured()) {
      throw new BadRequestException('Set TELEGRAM_BOT_TOKEN in the root .env and restart the API.');
    }

    // Prefer chat ID from the request (may not be saved yet)
    let chatId = (chatIdFromClient || '').trim();
    if (chatId) {
      await this.store.updateSettings(userId, { telegramChatId: chatId });
    } else {
      const s = await this.store.getSettings(userId);
      chatId = (s.telegramChatId || '').trim();
    }
    if (!chatId) {
      throw new BadRequestException(
        'Enter a Telegram chat ID first (message your bot, then paste the numeric ID or pick a discovered chat).',
      );
    }

    try {
      await this.telegram.getMe();
      await this.telegram.sendMessage(
        chatId,
        'ACA test: Telegram is connected. Signal alerts (smart money, score, whale, liquidity, risk, AI, price, volume) will notify this chat.',
      );
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    return { ok: true, chatId };
  }

  async disconnectTelegram(userId: string) {
    await this.store.updateSettings(userId, {
      telegramChatId: null,
      telegramAlerts: false,
    });
    await this.store.cancelPendingSignalDeliveries(userId, 'Telegram disconnected');
    return this.get(userId);
  }

  async recentTelegramChats() {
    try {
      return await this.telegram.recentChatIds();
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }
}
