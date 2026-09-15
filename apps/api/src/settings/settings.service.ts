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
    return {
      ...s,
      telegramBotConfigured: this.telegram.isConfigured(),
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

  async testTelegram(userId: string) {
    if (!this.telegram.isConfigured()) {
      throw new BadRequestException('Set TELEGRAM_BOT_TOKEN in the API .env first.');
    }
    const s = await this.store.getSettings(userId);
    if (!s.telegramChatId?.trim()) {
      throw new BadRequestException('Save a Telegram chat ID in settings first.');
    }
    await this.telegram.sendMessage(
      s.telegramChatId,
      'ACA test: Telegram alerts are connected. Price alerts will notify this chat.',
    );
    return { ok: true };
  }

  recentTelegramChats() {
    return this.telegram.recentChatIds();
  }
}
