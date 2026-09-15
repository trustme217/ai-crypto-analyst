import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function normalizeBotToken(raw: string | undefined | null): string {
  let t = (raw || '').trim();
  // Strip wrapping quotes from .env
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  // Users sometimes paste "bot123:AA..." from docs
  if (t.toLowerCase().startsWith('bot')) t = t.slice(3);
  return t.trim();
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string;

  constructor(private readonly config: ConfigService) {
    this.token = normalizeBotToken(this.config.get<string>('TELEGRAM_BOT_TOKEN'));
    if (this.token && !/^\d+:[A-Za-z0-9_-]+$/.test(this.token)) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN format looks invalid (expected digits:secret). Check .env quoting.',
      );
    }
  }

  isConfigured() {
    return Boolean(this.token);
  }

  private apiUrl(method: string) {
    return `https://api.telegram.org/bot${this.token}/${method}`;
  }

  private async callTelegram(method: string, payload?: Record<string, unknown>) {
    if (!this.token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set in .env');
    }
    const res = await fetch(this.apiUrl(method), {
      method: payload ? 'POST' : 'GET',
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error_code?: number;
      description?: string;
      result?: unknown;
    };

    if (!body.ok) {
      const code = body.error_code || res.status;
      let detail = body.description || res.statusText || `HTTP ${res.status}`;
      if (code === 404 || /not found/i.test(detail)) {
        detail =
          'Invalid bot token (Telegram returned Not Found). Recreate the token in BotFather and set TELEGRAM_BOT_TOKEN in the root .env, then restart the API.';
      } else if (/chat not found/i.test(detail)) {
        detail =
          'Chat not found. Open your bot in Telegram, press Start / send any message, then paste the numeric chat ID (or pick a discovered chat) and Save.';
      } else if (/unauthorized/i.test(detail) || code === 401) {
        detail = 'Unauthorized bot token. Check TELEGRAM_BOT_TOKEN.';
      }
      this.logger.warn(`Telegram ${method} failed: ${code} ${body.description || detail}`);
      throw new Error(detail);
    }
    return body;
  }

  async getMe() {
    const body = await this.callTelegram('getMe');
    const result = body.result as { id?: number; username?: string; first_name?: string } | undefined;
    return {
      ok: true as const,
      id: result?.id,
      username: result?.username,
      name: result?.first_name,
    };
  }

  async sendMessage(chatId: string, text: string) {
    const id = String(chatId || '').trim();
    if (!id) throw new Error('Telegram chat ID is empty');
    // Numeric IDs (and negative group IDs) only — reject accidental @mentions pasted as chat id
    if (!/^-?\d+$/.test(id)) {
      throw new Error(
        'Chat ID must be numeric (e.g. 123456789). Message the bot first, then use a discovered chat or getUpdates.',
      );
    }
    await this.callTelegram('sendMessage', {
      chat_id: Number(id),
      text,
      disable_web_page_preview: true,
    });
    return { ok: true as const };
  }

  /** Recent chats that messaged the bot — helps users find their chat ID. */
  async recentChatIds(limit = 8) {
    if (!this.token) {
      return { configured: false as const, chats: [] as Array<{ chatId: string; name: string }> };
    }
    try {
      const body = await this.callTelegram('getUpdates', { limit: 50 });
      const result = (body.result || []) as Array<{
        message?: {
          chat?: { id: number; type: string; title?: string; username?: string; first_name?: string };
        };
        edited_message?: {
          chat?: { id: number; type: string; title?: string; username?: string; first_name?: string };
        };
        my_chat_member?: {
          chat?: { id: number; type: string; title?: string; username?: string; first_name?: string };
        };
      }>;
      const map = new Map<string, string>();
      for (const update of result) {
        const chat =
          update.message?.chat || update.edited_message?.chat || update.my_chat_member?.chat;
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
    } catch (err) {
      this.logger.warn(`getUpdates failed: ${(err as Error).message}`);
      return { configured: true as const, chats: [] as Array<{ chatId: string; name: string }> };
    }
  }
}
