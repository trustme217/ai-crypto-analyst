import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string;

  constructor(private readonly config: ConfigService) {
    this.token = (this.config.get<string>('TELEGRAM_BOT_TOKEN') || '').trim();
  }

  isConfigured() {
    return Boolean(this.token);
  }

  async sendMessage(chatId: string, text: string) {
    if (!this.token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set in .env');
    }
    const id = chatId.trim();
    if (!id) throw new Error('Telegram chat ID is empty');

    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: id,
        text,
        disable_web_page_preview: true,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };
    if (!res.ok || !body.ok) {
      const detail = body.description || res.statusText || `HTTP ${res.status}`;
      this.logger.warn(`Telegram send failed: ${detail}`);
      throw new Error(`Telegram: ${detail}`);
    }
    return { ok: true as const };
  }

  /** Recent chats that messaged the bot — helps users find their chat ID. */
  async recentChatIds(limit = 8) {
    if (!this.token) return { configured: false as const, chats: [] as Array<{ chatId: string; name: string }> };
    const url = `https://api.telegram.org/bot${this.token}/getUpdates?limit=50`;
    const res = await fetch(url);
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: Array<{
        message?: {
          chat?: { id: number; type: string; title?: string; username?: string; first_name?: string };
          text?: string;
        };
      }>;
    };
    if (!body.ok || !Array.isArray(body.result)) {
      return { configured: true as const, chats: [] as Array<{ chatId: string; name: string }> };
    }
    const map = new Map<string, string>();
    for (const update of body.result) {
      const chat = update.message?.chat;
      if (!chat) continue;
      const chatId = String(chat.id);
      const name =
        chat.title ||
        [chat.first_name, chat.username ? `@${chat.username}` : ''].filter(Boolean).join(' ') ||
        chat.type;
      map.set(chatId, name);
    }
    return {
      configured: true as const,
      chats: [...map.entries()].slice(0, limit).map(([chatId, name]) => ({ chatId, name })),
    };
  }
}
