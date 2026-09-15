import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StoreService } from '../store/store.service';

@Injectable()
export class ChatService {
  private readonly aiUrl: string;

  constructor(
    private readonly store: StoreService,
    private readonly config: ConfigService,
  ) {
    this.aiUrl = this.config.get<string>('AI_SERVICE_URL') || 'http://127.0.0.1:8001';
  }

  async ask(message: string, userId?: string) {
    if (userId) {
      await this.store.createChat({ userId, role: 'user', content: message });
    }

    let reply: { reply: string; mode: string };
    try {
      const res = await fetch(`${this.aiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error(`AI ${res.status}`);
      reply = (await res.json()) as { reply: string; mode: string };
    } catch {
      throw new HttpException(
        'AI service unavailable. Start apps/ai (port 8001).',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (userId) {
      await this.store.createChat({ userId, role: 'assistant', content: reply.reply });
    }

    return reply;
  }

  async history(userId: string, limit = 40) {
    const messages = await this.store.chatHistory(userId, Math.min(limit, 100));
    return { messages };
  }
}
