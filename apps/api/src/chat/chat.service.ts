import { Injectable, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
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

  async listSessions(userId: string) {
    const sessions = await this.store.listChatSessions(userId);
    return { sessions };
  }

  async createSession(userId: string, title?: string) {
    const session = await this.store.createChatSession(userId, title || 'New research chat');
    return { session };
  }

  async sessionMessages(userId: string, sessionId: string) {
    const session = await this.store.getChatSession(userId, sessionId);
    if (!session) throw new NotFoundException('Session not found');
    const messages = await this.store.sessionMessages(userId, sessionId);
    return {
      session: {
        id: session.id,
        userId: session.userId,
        title: session.title,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
      messages,
    };
  }

  async ask(message: string, userId?: string, sessionId?: string) {
    let sid = sessionId || null;
    if (userId) {
      if (sid) {
        const session = await this.store.getChatSession(userId, sid);
        if (!session) throw new NotFoundException('Session not found');
      } else {
        const created = await this.store.createChatSession(userId);
        sid = created.id;
      }
      await this.store.createChat({ userId, sessionId: sid, role: 'user', content: message });
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

    if (userId && sid) {
      await this.store.createChat({
        userId,
        sessionId: sid,
        role: 'assistant',
        content: reply.reply,
      });
    }

    return { ...reply, sessionId: sid };
  }

  async history(userId: string, limit = 40) {
    const messages = await this.store.chatHistory(userId, Math.min(limit, 100));
    return { messages };
  }
}
