import { Global, Module, OnModuleInit, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.importJsonIfNeeded();
  }

  private async importJsonIfNeeded() {
    const marker = path.join(process.cwd(), 'data', '.json-imported');
    const jsonFile = path.join(process.cwd(), 'data', 'store.json');
    try {
      await fs.access(marker);
      return;
    } catch {
      /* not imported yet */
    }
    let raw: string;
    try {
      raw = await fs.readFile(jsonFile, 'utf8');
    } catch {
      await fs.mkdir(path.dirname(marker), { recursive: true });
      await fs.writeFile(marker, new Date().toISOString(), 'utf8');
      return;
    }

    const db = JSON.parse(raw) as {
      users?: Array<Record<string, unknown>>;
      watchlist?: Array<Record<string, unknown>>;
      analyses?: Array<Record<string, unknown>>;
      chats?: Array<Record<string, unknown>>;
      portfolio?: Array<Record<string, unknown>>;
      alerts?: Array<Record<string, unknown>>;
      settings?: Array<Record<string, unknown>>;
      copyFollows?: Array<Record<string, unknown>>;
    };

    const count = await this.user.count();
    if (count > 0) {
      await fs.writeFile(marker, new Date().toISOString(), 'utf8');
      return;
    }

    this.logger.log('Importing legacy store.json into PostgreSQL…');
    for (const u of db.users || []) {
      await this.user.create({
        data: {
          id: String(u.id),
          email: String(u.email),
          passwordHash: String(u.passwordHash),
          displayName: (u.displayName as string) || null,
          createdAt: new Date(String(u.createdAt || Date.now())),
          updatedAt: new Date(String(u.updatedAt || Date.now())),
        },
      });
    }
    for (const s of db.settings || []) {
      await this.userSettings.create({
        data: {
          userId: String(s.userId),
          displayName: (s.displayName as string) || null,
          defaultTimeframe: String(s.defaultTimeframe || '1d'),
          riskTolerance: String(s.riskTolerance || 'medium'),
          emailAlerts: Boolean(s.emailAlerts),
          telegramAlerts: s.telegramAlerts !== false,
          telegramChatId: (s.telegramChatId as string) || null,
          signalStyle: String(s.signalStyle || 'balanced'),
          currency: String(s.currency || 'USD'),
          updatedAt: new Date(String(s.updatedAt || Date.now())),
        },
      });
    }
    for (const w of db.watchlist || []) {
      await this.watchlistItem.create({
        data: {
          id: String(w.id),
          userId: String(w.userId),
          coingeckoId: String(w.coingeckoId),
          symbol: String(w.symbol),
          name: String(w.name),
          createdAt: new Date(String(w.createdAt || Date.now())),
        },
      });
    }
    for (const a of db.analyses || []) {
      await this.analysisReport.create({
        data: {
          id: String(a.id),
          userId: (a.userId as string) || null,
          coingeckoId: String(a.coingeckoId),
          symbol: String(a.symbol),
          name: String(a.name),
          timeframe: String(a.timeframe || '1d'),
          sentiment: String(a.sentiment),
          score: Number(a.score),
          summary: String(a.summary),
          thesis: String(a.thesis),
          risks: String(a.risks),
          catalysts: String(a.catalysts),
          rawJson: String(a.rawJson),
          createdAt: new Date(String(a.createdAt || Date.now())),
        },
      });
    }
    // Legacy flat chats → one session per user
    const chatsByUser = new Map<string, Array<Record<string, unknown>>>();
    for (const c of db.chats || []) {
      const uid = c.userId ? String(c.userId) : null;
      if (!uid) continue;
      if (!chatsByUser.has(uid)) chatsByUser.set(uid, []);
      chatsByUser.get(uid)!.push(c);
    }
    for (const [userId, msgs] of chatsByUser) {
      const session = await this.chatSession.create({
        data: { userId, title: 'Imported chat' },
      });
      for (const m of msgs) {
        await this.chatMessage.create({
          data: {
            id: String(m.id),
            userId,
            sessionId: session.id,
            role: String(m.role),
            content: String(m.content),
            createdAt: new Date(String(m.createdAt || Date.now())),
          },
        });
      }
    }
    for (const p of db.portfolio || []) {
      await this.portfolioPosition.create({
        data: {
          id: String(p.id),
          userId: String(p.userId),
          coingeckoId: String(p.coingeckoId),
          symbol: String(p.symbol),
          name: String(p.name),
          quantity: Number(p.quantity),
          avgCostUsd: Number(p.avgCostUsd),
          createdAt: new Date(String(p.createdAt || Date.now())),
          updatedAt: new Date(String(p.updatedAt || Date.now())),
        },
      });
    }
    for (const a of db.alerts || []) {
      await this.priceAlert.create({
        data: {
          id: String(a.id),
          userId: String(a.userId),
          coingeckoId: String(a.coingeckoId),
          symbol: String(a.symbol),
          name: String(a.name),
          direction: String(a.direction),
          targetPrice: Number(a.targetPrice),
          active: a.active !== false,
          triggeredAt: a.triggeredAt ? new Date(String(a.triggeredAt)) : null,
          createdAt: new Date(String(a.createdAt || Date.now())),
        },
      });
    }
    for (const f of db.copyFollows || []) {
      await this.copyFollow.create({
        data: {
          id: String(f.id),
          userId: String(f.userId),
          traderId: String(f.traderId),
          allocationPct: Number(f.allocationPct),
          active: f.active !== false,
          createdAt: new Date(String(f.createdAt || Date.now())),
        },
      });
    }

    await fs.writeFile(marker, new Date().toISOString(), 'utf8');
    this.logger.log('Legacy store.json import complete.');
  }
}

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
