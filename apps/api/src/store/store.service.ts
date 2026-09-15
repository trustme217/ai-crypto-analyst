import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WatchlistItem = {
  id: string;
  userId: string;
  coingeckoId: string;
  symbol: string;
  name: string;
  createdAt: string;
};

export type AnalysisReport = {
  id: string;
  userId: string | null;
  coingeckoId: string;
  symbol: string;
  name: string;
  timeframe: string;
  sentiment: string;
  score: number;
  summary: string;
  thesis: string;
  risks: string;
  catalysts: string;
  rawJson: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  userId: string | null;
  sessionId: string | null;
  role: string;
  content: string;
  createdAt: string;
};

export type ChatSession = {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioPosition = {
  id: string;
  userId: string;
  coingeckoId: string;
  symbol: string;
  name: string;
  quantity: number;
  avgCostUsd: number;
  createdAt: string;
  updatedAt: string;
};

export type PriceAlert = {
  id: string;
  userId: string;
  coingeckoId: string;
  symbol: string;
  name: string;
  direction: 'above' | 'below';
  targetPrice: number;
  active: boolean;
  triggeredAt: string | null;
  createdAt: string;
};

export type UserSettings = {
  userId: string;
  displayName: string | null;
  defaultTimeframe: string;
  riskTolerance: 'low' | 'medium' | 'high';
  emailAlerts: boolean;
  telegramAlerts: boolean;
  telegramChatId: string | null;
  signalStyle: 'conservative' | 'balanced' | 'aggressive';
  currency: string;
  updatedAt: string;
};

export type CopyFollow = {
  id: string;
  userId: string;
  traderId: string;
  allocationPct: number;
  active: boolean;
  createdAt: string;
};

export type CopyPaperTrade = {
  id: string;
  userId: string;
  traderId: string;
  coingeckoId: string;
  symbol: string;
  name: string;
  side: string;
  quantity: number;
  priceUsd: number;
  notionalUsd: number;
  note: string | null;
  createdAt: string;
};

export type AlertDelivery = {
  id: string;
  alertId: string;
  status: string;
  attempts: number;
  nextRetryAt: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

function mapUser(u: {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: u.id,
    email: u.email,
    passwordHash: u.passwordHash,
    displayName: u.displayName,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string) {
    const u = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return u ? mapUser(u) : null;
  }

  async findUserById(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    return u ? mapUser(u) : null;
  }

  async createUser(data: { email: string; passwordHash: string; displayName?: string }) {
    const user = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        displayName: data.displayName || null,
        settings: {
          create: {
            displayName: data.displayName || null,
            defaultTimeframe: '1d',
            riskTolerance: 'medium',
            emailAlerts: false,
            telegramAlerts: true,
            telegramChatId: null,
            signalStyle: 'balanced',
            currency: 'USD',
          },
        },
      },
    });
    return mapUser(user);
  }

  async listWatchlist(userId: string): Promise<WatchlistItem[]> {
    const rows = await this.prisma.watchlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((w) => ({
      id: w.id,
      userId: w.userId,
      coingeckoId: w.coingeckoId,
      symbol: w.symbol,
      name: w.name,
      createdAt: w.createdAt.toISOString(),
    }));
  }

  async upsertWatchlist(data: {
    userId: string;
    coingeckoId: string;
    symbol: string;
    name: string;
  }): Promise<WatchlistItem> {
    const w = await this.prisma.watchlistItem.upsert({
      where: { userId_coingeckoId: { userId: data.userId, coingeckoId: data.coingeckoId } },
      create: data,
      update: { symbol: data.symbol, name: data.name },
    });
    return {
      id: w.id,
      userId: w.userId,
      coingeckoId: w.coingeckoId,
      symbol: w.symbol,
      name: w.name,
      createdAt: w.createdAt.toISOString(),
    };
  }

  async removeWatchlist(userId: string, coingeckoId: string) {
    try {
      await this.prisma.watchlistItem.delete({
        where: { userId_coingeckoId: { userId, coingeckoId } },
      });
      return true;
    } catch {
      return false;
    }
  }

  async createAnalysis(data: Omit<AnalysisReport, 'id' | 'createdAt'>): Promise<AnalysisReport> {
    const report = await this.prisma.analysisReport.create({ data });
    const excess = await this.prisma.analysisReport.findMany({
      orderBy: { createdAt: 'desc' },
      skip: 200,
      select: { id: true },
    });
    if (excess.length) {
      await this.prisma.analysisReport.deleteMany({ where: { id: { in: excess.map((e) => e.id) } } });
    }
    return {
      ...data,
      id: report.id,
      createdAt: report.createdAt.toISOString(),
    };
  }

  async recentAnalyses(limit: number, userId?: string): Promise<AnalysisReport[]> {
    const rows = await this.prisma.analysisReport.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((a) => ({
      id: a.id,
      userId: a.userId,
      coingeckoId: a.coingeckoId,
      symbol: a.symbol,
      name: a.name,
      timeframe: a.timeframe,
      sentiment: a.sentiment,
      score: a.score,
      summary: a.summary,
      thesis: a.thesis,
      risks: a.risks,
      catalysts: a.catalysts,
      rawJson: a.rawJson,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async listChatSessions(userId: string): Promise<ChatSession[]> {
    const rows = await this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    });
    return rows.map((s) => ({
      id: s.id,
      userId: s.userId,
      title: s.title,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async createChatSession(userId: string, title = 'New research chat'): Promise<ChatSession> {
    const s = await this.prisma.chatSession.create({ data: { userId, title } });
    return {
      id: s.id,
      userId: s.userId,
      title: s.title,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  async getChatSession(userId: string, sessionId: string) {
    return this.prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
  }

  async touchChatSession(sessionId: string, title?: string) {
    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { ...(title ? { title } : {}), updatedAt: new Date() },
    });
  }

  async createChat(data: {
    userId: string | null;
    sessionId?: string | null;
    role: string;
    content: string;
  }): Promise<ChatMessage> {
    const msg = await this.prisma.chatMessage.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId || null,
        role: data.role,
        content: data.content,
      },
    });
    if (data.sessionId) {
      const patch: { updatedAt: Date; title?: string } = { updatedAt: new Date() };
      if (data.role === 'user') {
        const session = await this.prisma.chatSession.findUnique({ where: { id: data.sessionId } });
        if (session && (session.title === 'New research chat' || session.title === 'Imported chat')) {
          patch.title = data.content.replace(/\s+/g, ' ').trim().slice(0, 48) || session.title;
        }
      }
      await this.prisma.chatSession.update({ where: { id: data.sessionId }, data: patch });
    }
    return {
      id: msg.id,
      userId: msg.userId,
      sessionId: msg.sessionId,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
    };
  }

  async chatHistory(userId: string, limit: number): Promise<ChatMessage[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
    return rows.reverse().map((c) => ({
      id: c.id,
      userId: c.userId,
      sessionId: c.sessionId,
      role: c.role,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async sessionMessages(userId: string, sessionId: string, limit = 100): Promise<ChatMessage[]> {
    const session = await this.getChatSession(userId, sessionId);
    if (!session) return [];
    const rows = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((c) => ({
      id: c.id,
      userId: c.userId,
      sessionId: c.sessionId,
      role: c.role,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async listPortfolio(userId: string): Promise<PortfolioPosition[]> {
    const rows = await this.prisma.portfolioPosition.findMany({ where: { userId } });
    return rows.map((p) => ({
      id: p.id,
      userId: p.userId,
      coingeckoId: p.coingeckoId,
      symbol: p.symbol,
      name: p.name,
      quantity: p.quantity,
      avgCostUsd: p.avgCostUsd,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  async upsertPortfolio(data: {
    userId: string;
    coingeckoId: string;
    symbol: string;
    name: string;
    quantity: number;
    avgCostUsd: number;
  }): Promise<PortfolioPosition> {
    const p = await this.prisma.portfolioPosition.upsert({
      where: { userId_coingeckoId: { userId: data.userId, coingeckoId: data.coingeckoId } },
      create: data,
      update: {
        quantity: data.quantity,
        avgCostUsd: data.avgCostUsd,
        symbol: data.symbol,
        name: data.name,
      },
    });
    return {
      id: p.id,
      userId: p.userId,
      coingeckoId: p.coingeckoId,
      symbol: p.symbol,
      name: p.name,
      quantity: p.quantity,
      avgCostUsd: p.avgCostUsd,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async removePortfolio(userId: string, id: string) {
    const row = await this.prisma.portfolioPosition.findFirst({ where: { id, userId } });
    if (!row) return false;
    await this.prisma.portfolioPosition.delete({ where: { id } });
    return true;
  }

  async listAlerts(userId: string): Promise<PriceAlert[]> {
    const rows = await this.prisma.priceAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((a) => ({
      id: a.id,
      userId: a.userId,
      coingeckoId: a.coingeckoId,
      symbol: a.symbol,
      name: a.name,
      direction: a.direction as 'above' | 'below',
      targetPrice: a.targetPrice,
      active: a.active,
      triggeredAt: iso(a.triggeredAt),
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async listActiveAlerts(): Promise<PriceAlert[]> {
    const rows = await this.prisma.priceAlert.findMany({
      where: { active: true, triggeredAt: null },
    });
    return rows.map((a) => ({
      id: a.id,
      userId: a.userId,
      coingeckoId: a.coingeckoId,
      symbol: a.symbol,
      name: a.name,
      direction: a.direction as 'above' | 'below',
      targetPrice: a.targetPrice,
      active: a.active,
      triggeredAt: iso(a.triggeredAt),
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async markAlertTriggered(id: string) {
    try {
      const alert = await this.prisma.priceAlert.update({
        where: { id },
        data: { active: false, triggeredAt: new Date() },
      });
      return {
        id: alert.id,
        userId: alert.userId,
        coingeckoId: alert.coingeckoId,
        symbol: alert.symbol,
        name: alert.name,
        direction: alert.direction as 'above' | 'below',
        targetPrice: alert.targetPrice,
        active: alert.active,
        triggeredAt: iso(alert.triggeredAt),
        createdAt: alert.createdAt.toISOString(),
      };
    } catch {
      return null;
    }
  }

  async createAlert(
    data: Omit<PriceAlert, 'id' | 'createdAt' | 'triggeredAt' | 'active'>,
  ): Promise<PriceAlert> {
    const alert = await this.prisma.priceAlert.create({
      data: {
        userId: data.userId,
        coingeckoId: data.coingeckoId,
        symbol: data.symbol,
        name: data.name,
        direction: data.direction,
        targetPrice: data.targetPrice,
        active: true,
      },
    });
    return {
      id: alert.id,
      userId: alert.userId,
      coingeckoId: alert.coingeckoId,
      symbol: alert.symbol,
      name: alert.name,
      direction: alert.direction as 'above' | 'below',
      targetPrice: alert.targetPrice,
      active: alert.active,
      triggeredAt: null,
      createdAt: alert.createdAt.toISOString(),
    };
  }

  async removeAlert(userId: string, id: string) {
    const row = await this.prisma.priceAlert.findFirst({ where: { id, userId } });
    if (!row) return false;
    await this.prisma.priceAlert.delete({ where: { id } });
    return true;
  }

  async enqueueAlertDelivery(alertId: string, error?: string) {
    const existing = await this.prisma.alertDelivery.findFirst({
      where: { alertId, status: { in: ['pending', 'retry'] } },
    });
    if (existing) {
      return this.prisma.alertDelivery.update({
        where: { id: existing.id },
        data: {
          status: 'retry',
          attempts: existing.attempts + 1,
          lastError: error || existing.lastError,
          nextRetryAt: new Date(Date.now() + Math.min(30 * 60_000, 15_000 * 2 ** existing.attempts)),
        },
      });
    }
    return this.prisma.alertDelivery.create({
      data: {
        alertId,
        status: 'pending',
        attempts: 0,
        lastError: error || null,
        nextRetryAt: new Date(),
      },
    });
  }

  async listDueDeliveries(limit = 20) {
    return this.prisma.alertDelivery.findMany({
      where: {
        status: { in: ['pending', 'retry'] },
        nextRetryAt: { lte: new Date() },
        attempts: { lt: 5 },
      },
      include: { alert: true },
      take: limit,
      orderBy: { nextRetryAt: 'asc' },
    });
  }

  async markDeliverySent(id: string) {
    return this.prisma.alertDelivery.update({
      where: { id },
      data: { status: 'sent' },
    });
  }

  async markDeliveryFailed(id: string, attempts: number, error: string) {
    if (attempts >= 5) {
      return this.prisma.alertDelivery.update({
        where: { id },
        data: { status: 'failed', attempts, lastError: error },
      });
    }
    return this.prisma.alertDelivery.update({
      where: { id },
      data: {
        status: 'retry',
        attempts,
        lastError: error,
        nextRetryAt: new Date(Date.now() + Math.min(30 * 60_000, 15_000 * 2 ** attempts)),
      },
    });
  }

  async getSettings(userId: string): Promise<UserSettings> {
    let s = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (!s) {
      s = await this.prisma.userSettings.create({
        data: {
          userId,
          displayName: null,
          defaultTimeframe: '1d',
          riskTolerance: 'medium',
          emailAlerts: false,
          telegramAlerts: true,
          telegramChatId: null,
          signalStyle: 'balanced',
          currency: 'USD',
        },
      });
    }
    return {
      userId: s.userId,
      displayName: s.displayName,
      defaultTimeframe: s.defaultTimeframe,
      riskTolerance: s.riskTolerance as UserSettings['riskTolerance'],
      emailAlerts: s.emailAlerts,
      telegramAlerts: s.telegramAlerts,
      telegramChatId: s.telegramChatId,
      signalStyle: s.signalStyle as UserSettings['signalStyle'],
      currency: s.currency,
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  async updateSettings(
    userId: string,
    patch: Partial<Omit<UserSettings, 'userId' | 'updatedAt'>>,
  ): Promise<UserSettings> {
    await this.getSettings(userId);
    const s = await this.prisma.userSettings.update({
      where: { userId },
      data: {
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.defaultTimeframe !== undefined ? { defaultTimeframe: patch.defaultTimeframe } : {}),
        ...(patch.riskTolerance !== undefined ? { riskTolerance: patch.riskTolerance } : {}),
        ...(patch.emailAlerts !== undefined ? { emailAlerts: patch.emailAlerts } : {}),
        ...(patch.telegramAlerts !== undefined ? { telegramAlerts: patch.telegramAlerts } : {}),
        ...(patch.telegramChatId !== undefined ? { telegramChatId: patch.telegramChatId } : {}),
        ...(patch.signalStyle !== undefined ? { signalStyle: patch.signalStyle } : {}),
        ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
      },
    });
    return {
      userId: s.userId,
      displayName: s.displayName,
      defaultTimeframe: s.defaultTimeframe,
      riskTolerance: s.riskTolerance as UserSettings['riskTolerance'],
      emailAlerts: s.emailAlerts,
      telegramAlerts: s.telegramAlerts,
      telegramChatId: s.telegramChatId,
      signalStyle: s.signalStyle as UserSettings['signalStyle'],
      currency: s.currency,
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  async listCopyFollows(userId: string): Promise<CopyFollow[]> {
    const rows = await this.prisma.copyFollow.findMany({ where: { userId, active: true } });
    return rows.map((f) => ({
      id: f.id,
      userId: f.userId,
      traderId: f.traderId,
      allocationPct: f.allocationPct,
      active: f.active,
      createdAt: f.createdAt.toISOString(),
    }));
  }

  async listAllActiveCopyFollows(): Promise<CopyFollow[]> {
    const rows = await this.prisma.copyFollow.findMany({ where: { active: true } });
    return rows.map((f) => ({
      id: f.id,
      userId: f.userId,
      traderId: f.traderId,
      allocationPct: f.allocationPct,
      active: f.active,
      createdAt: f.createdAt.toISOString(),
    }));
  }

  async followTrader(userId: string, traderId: string, allocationPct: number): Promise<CopyFollow> {
    const f = await this.prisma.copyFollow.upsert({
      where: { userId_traderId: { userId, traderId } },
      create: { userId, traderId, allocationPct, active: true },
      update: { active: true, allocationPct },
    });
    return {
      id: f.id,
      userId: f.userId,
      traderId: f.traderId,
      allocationPct: f.allocationPct,
      active: f.active,
      createdAt: f.createdAt.toISOString(),
    };
  }

  async unfollowTrader(userId: string, traderId: string) {
    const existing = await this.prisma.copyFollow.findUnique({
      where: { userId_traderId: { userId, traderId } },
    });
    if (!existing) return false;
    await this.prisma.copyFollow.update({
      where: { id: existing.id },
      data: { active: false },
    });
    return true;
  }

  async createCopyPaperTrade(data: Omit<CopyPaperTrade, 'id' | 'createdAt'>): Promise<CopyPaperTrade> {
    const t = await this.prisma.copyPaperTrade.create({ data });
    return {
      id: t.id,
      userId: t.userId,
      traderId: t.traderId,
      coingeckoId: t.coingeckoId,
      symbol: t.symbol,
      name: t.name,
      side: t.side,
      quantity: t.quantity,
      priceUsd: t.priceUsd,
      notionalUsd: t.notionalUsd,
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    };
  }

  async listCopyPaperTrades(userId: string, limit = 30): Promise<CopyPaperTrade[]> {
    const rows = await this.prisma.copyPaperTrade.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((t) => ({
      id: t.id,
      userId: t.userId,
      traderId: t.traderId,
      coingeckoId: t.coingeckoId,
      symbol: t.symbol,
      name: t.name,
      side: t.side,
      quantity: t.quantity,
      priceUsd: t.priceUsd,
      notionalUsd: t.notionalUsd,
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    }));
  }
}
