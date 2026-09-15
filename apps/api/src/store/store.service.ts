import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

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
  role: string;
  content: string;
  createdAt: string;
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

type DbShape = {
  users: User[];
  watchlist: WatchlistItem[];
  analyses: AnalysisReport[];
  chats: ChatMessage[];
  portfolio: PortfolioPosition[];
  alerts: PriceAlert[];
  settings: UserSettings[];
  copyFollows: CopyFollow[];
};

function cuid() {
  return `c${Date.now().toString(36)}${randomBytes(6).toString('hex')}`;
}

@Injectable()
export class StoreService implements OnModuleInit {
  private file = path.join(process.cwd(), 'data', 'store.json');
  private db: DbShape = {
    users: [],
    watchlist: [],
    analyses: [],
    chats: [],
    portfolio: [],
    alerts: [],
    settings: [],
    copyFollows: [],
  };

  async onModuleInit() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      this.db = { ...this.db, ...JSON.parse(raw) };
      this.db.portfolio ||= [];
      this.db.alerts ||= [];
      this.db.settings ||= [];
      this.db.copyFollows ||= [];
    } catch {
      await this.persist();
    }
  }

  private async persist() {
    await fs.writeFile(this.file, JSON.stringify(this.db, null, 2), 'utf8');
  }

  async findUserByEmail(email: string) {
    return this.db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async findUserById(id: string) {
    return this.db.users.find((u) => u.id === id) || null;
  }

  async createUser(data: { email: string; passwordHash: string; displayName?: string }) {
    const now = new Date().toISOString();
    const user: User = {
      id: cuid(),
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      displayName: data.displayName || null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.users.push(user);
    this.db.settings.push({
      userId: user.id,
      displayName: user.displayName,
      defaultTimeframe: '1d',
      riskTolerance: 'medium',
      emailAlerts: false,
      telegramAlerts: true,
      telegramChatId: null,
      signalStyle: 'balanced',
      currency: 'USD',
      updatedAt: now,
    });
    await this.persist();
    return user;
  }

  async listWatchlist(userId: string) {
    return this.db.watchlist
      .filter((w) => w.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async upsertWatchlist(data: {
    userId: string;
    coingeckoId: string;
    symbol: string;
    name: string;
  }) {
    const existing = this.db.watchlist.find(
      (w) => w.userId === data.userId && w.coingeckoId === data.coingeckoId,
    );
    if (existing) {
      existing.symbol = data.symbol;
      existing.name = data.name;
      await this.persist();
      return existing;
    }
    const item: WatchlistItem = {
      id: cuid(),
      createdAt: new Date().toISOString(),
      ...data,
    };
    this.db.watchlist.push(item);
    await this.persist();
    return item;
  }

  async removeWatchlist(userId: string, coingeckoId: string) {
    const before = this.db.watchlist.length;
    this.db.watchlist = this.db.watchlist.filter(
      (w) => !(w.userId === userId && w.coingeckoId === coingeckoId),
    );
    if (this.db.watchlist.length === before) return false;
    await this.persist();
    return true;
  }

  async createAnalysis(data: Omit<AnalysisReport, 'id' | 'createdAt'>) {
    const report: AnalysisReport = {
      id: cuid(),
      createdAt: new Date().toISOString(),
      ...data,
    };
    this.db.analyses.unshift(report);
    this.db.analyses = this.db.analyses.slice(0, 200);
    await this.persist();
    return report;
  }

  async recentAnalyses(limit: number, userId?: string) {
    return this.db.analyses
      .filter((a) => (userId ? a.userId === userId : true))
      .slice(0, limit);
  }

  async createChat(data: { userId: string | null; role: string; content: string }) {
    const msg: ChatMessage = {
      id: cuid(),
      createdAt: new Date().toISOString(),
      ...data,
    };
    this.db.chats.push(msg);
    this.db.chats = this.db.chats.slice(-500);
    await this.persist();
    return msg;
  }

  async chatHistory(userId: string, limit: number) {
    return this.db.chats.filter((c) => c.userId === userId).slice(-limit);
  }

  async listPortfolio(userId: string) {
    return this.db.portfolio.filter((p) => p.userId === userId);
  }

  async upsertPortfolio(data: {
    userId: string;
    coingeckoId: string;
    symbol: string;
    name: string;
    quantity: number;
    avgCostUsd: number;
  }) {
    const now = new Date().toISOString();
    const existing = this.db.portfolio.find(
      (p) => p.userId === data.userId && p.coingeckoId === data.coingeckoId,
    );
    if (existing) {
      existing.quantity = data.quantity;
      existing.avgCostUsd = data.avgCostUsd;
      existing.symbol = data.symbol;
      existing.name = data.name;
      existing.updatedAt = now;
      await this.persist();
      return existing;
    }
    const row: PortfolioPosition = {
      id: cuid(),
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    this.db.portfolio.push(row);
    await this.persist();
    return row;
  }

  async removePortfolio(userId: string, id: string) {
    const before = this.db.portfolio.length;
    this.db.portfolio = this.db.portfolio.filter((p) => !(p.userId === userId && p.id === id));
    if (this.db.portfolio.length === before) return false;
    await this.persist();
    return true;
  }

  async listAlerts(userId: string) {
    return this.db.alerts
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listActiveAlerts() {
    return this.db.alerts.filter((a) => a.active && !a.triggeredAt);
  }

  async markAlertTriggered(id: string) {
    const alert = this.db.alerts.find((a) => a.id === id);
    if (!alert) return null;
    alert.active = false;
    alert.triggeredAt = new Date().toISOString();
    await this.persist();
    return alert;
  }

  async createAlert(data: Omit<PriceAlert, 'id' | 'createdAt' | 'triggeredAt' | 'active'>) {
    const alert: PriceAlert = {
      id: cuid(),
      active: true,
      triggeredAt: null,
      createdAt: new Date().toISOString(),
      ...data,
    };
    this.db.alerts.unshift(alert);
    await this.persist();
    return alert;
  }

  async removeAlert(userId: string, id: string) {
    const before = this.db.alerts.length;
    this.db.alerts = this.db.alerts.filter((a) => !(a.userId === userId && a.id === id));
    if (this.db.alerts.length === before) return false;
    await this.persist();
    return true;
  }

  async getSettings(userId: string) {
    let s = this.db.settings.find((x) => x.userId === userId);
    if (!s) {
      s = {
        userId,
        displayName: null,
        defaultTimeframe: '1d',
        riskTolerance: 'medium',
        emailAlerts: false,
        telegramAlerts: true,
        telegramChatId: null,
        signalStyle: 'balanced',
        currency: 'USD',
        updatedAt: new Date().toISOString(),
      };
      this.db.settings.push(s);
      await this.persist();
    } else {
      // Migrate older store.json rows
      if (typeof (s as UserSettings).telegramAlerts !== 'boolean') {
        (s as UserSettings).telegramAlerts = true;
      }
      if ((s as UserSettings).telegramChatId === undefined) {
        (s as UserSettings).telegramChatId = null;
      }
    }
    return s;
  }

  async updateSettings(
    userId: string,
    patch: Partial<Omit<UserSettings, 'userId' | 'updatedAt'>>,
  ) {
    const s = await this.getSettings(userId);
    Object.assign(s, patch, { updatedAt: new Date().toISOString() });
    await this.persist();
    return s;
  }

  async listCopyFollows(userId: string) {
    return this.db.copyFollows.filter((f) => f.userId === userId && f.active);
  }

  async followTrader(userId: string, traderId: string, allocationPct: number) {
    const existing = this.db.copyFollows.find(
      (f) => f.userId === userId && f.traderId === traderId,
    );
    if (existing) {
      existing.active = true;
      existing.allocationPct = allocationPct;
      await this.persist();
      return existing;
    }
    const row: CopyFollow = {
      id: cuid(),
      userId,
      traderId,
      allocationPct,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.db.copyFollows.push(row);
    await this.persist();
    return row;
  }

  async unfollowTrader(userId: string, traderId: string) {
    const existing = this.db.copyFollows.find(
      (f) => f.userId === userId && f.traderId === traderId,
    );
    if (!existing) return false;
    existing.active = false;
    await this.persist();
    return true;
  }
}
