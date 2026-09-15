export type MarketOverview = {
  global: {
    marketCap: number;
    volume24h: number;
    btcDominance: number;
    ethDominance: number;
    marketCapChange24h: number;
  };
  coins: Array<{
    id: string;
    symbol: string;
    name: string;
    image: string;
    current_price: number;
    market_cap: number;
    market_cap_rank: number | null;
    total_volume: number;
    price_change_percentage_24h: number | null;
    sparkline_in_7d?: { price: number[] };
  }>;
};

export type CoinDetail = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  description: string;
  homepage: string | null;
  twitter: string | null;
  categories: string[];
  market: {
    price: number;
    marketCap: number;
    volume24h: number;
    high24h: number;
    low24h: number;
    change24h: number;
    change7d: number;
    change30d: number;
    circulatingSupply: number;
    ath: number;
    athChange: number;
    sparkline: number[];
  };
};

export type AnalysisResult = {
  id: string;
  coin: {
    id: string;
    symbol: string;
    name: string;
    image: string;
    price: number;
    change24h: number;
  };
  timeframe: string;
  analysis: {
    sentiment: 'bullish' | 'bearish' | 'neutral';
    score: number;
    summary: string;
    thesis: string;
    risks: string[];
    catalysts: string[];
    keyLevels?: { support?: number; resistance?: number };
    mode: 'llm' | 'heuristic';
  };
  createdAt: string;
};

export type TradingSignal = {
  id: string;
  coingeckoId: string;
  symbol: string;
  name: string;
  image: string;
  side: 'long' | 'short' | 'neutral';
  confidence: number;
  timeframe: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  rationale: string;
  change24h: number;
  change7d?: number | null;
  volMcap?: number;
  scores?: {
    token: string;
    score: number;
    smartMoney: number;
    liquidity: number;
    volume: number;
    momentum: number;
    holderQuality: number;
    risk: number;
  };
  generatedAt: string;
};

export type CopyLeader = {
  id: string;
  name: string;
  style: string;
  winRate: number;
  avgReturn30d: number;
  followers: number;
  risk: string;
  focus: string[];
  bio: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const GUEST_WATCH_KEY = 'aca_guest_watchlist';

function authHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('aca_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isLoggedIn() {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('aca_token'));
}

function readGuestWatch(): Array<{ coingeckoId: string; symbol: string; name: string }> {
  try {
    return JSON.parse(localStorage.getItem(GUEST_WATCH_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeGuestWatch(items: Array<{ coingeckoId: string; symbol: string; name: string }>) {
  localStorage.setItem(GUEST_WATCH_KEY, JSON.stringify(items));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text).message || text;
    } catch {
      /* keep text */
    }
    throw new Error(Array.isArray(message) ? message.join(', ') : message || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  overview: () => request<MarketOverview>('/market/overview'),
  search: (q: string) =>
    request<{ coins: Array<{ id: string; name: string; symbol: string; thumb: string }> }>(
      `/market/search?q=${encodeURIComponent(q)}`,
    ),
  coin: (id: string) => request<CoinDetail>(`/market/coins/${encodeURIComponent(id)}`),
  holders: (coingeckoId: string, symbol?: string) =>
    request<{
      coingeckoId: string;
      symbol: string;
      holders: number;
      holderConcentration: number;
      top10Pct: number;
      top20Pct: number;
      smartMoneyOwnership: number;
      whaleOwnership: number;
      creatorOwnership: number;
      holderQualityScore: number;
      distributionChanges: Array<{
        metric: string;
        before: number;
        now: number;
        delta: number;
      }>;
      alerts: Array<{
        type: string;
        title: string;
        before: number;
        now: number;
        risk: 'LOW' | 'MEDIUM' | 'HIGH';
        detail: string;
      }>;
      source: string;
      snapshotAt: string;
      previousSnapshotAt: string | null;
    }>(
      `/holders/${encodeURIComponent(coingeckoId)}${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ''}`,
    ),
  analyze: (coingeckoId: string, timeframe = '1d') =>
    request<AnalysisResult>('/analysis', {
      method: 'POST',
      body: JSON.stringify({ coingeckoId, timeframe }),
    }),
  recentAnalyses: () =>
    request<
      Array<{
        id: string;
        coingeckoId: string;
        symbol: string;
        name: string;
        sentiment: string;
        score: number;
        summary: string;
        createdAt: string;
      }>
    >('/analysis/recent'),
  chat: (message: string, sessionId?: string) =>
    request<{ reply: string; mode: string; sessionId?: string | null }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, sessionId }),
    }),
  chatHistory: () =>
    request<{
      messages: Array<{
        id: string;
        userId: string | null;
        sessionId?: string | null;
        role: string;
        content: string;
        createdAt: string;
      }>;
    }>('/chat/history'),
  chatSessions: () =>
    request<{
      sessions: Array<{ id: string; userId: string; title: string; createdAt: string; updatedAt: string }>;
    }>('/chat/sessions'),
  createChatSession: (title?: string) =>
    request<{ session: { id: string; userId: string; title: string; createdAt: string; updatedAt: string } }>(
      '/chat/sessions',
      { method: 'POST', body: JSON.stringify({ title }) },
    ),
  chatSession: (id: string) =>
    request<{
      session: { id: string; userId: string; title: string; createdAt: string; updatedAt: string };
      messages: Array<{
        id: string;
        userId: string | null;
        sessionId: string | null;
        role: string;
        content: string;
        createdAt: string;
      }>;
    }>(`/chat/sessions/${encodeURIComponent(id)}`),
  wallet: (address: string) =>
    request<{
      address: string;
      solBalance: number | null;
      tokenCount: number;
      tokens: Array<{ mint: string; amount: number | null; decimals: number; account: string }>;
      recentSignatures: Array<{ signature: string; slot: number; blockTime: number | null }>;
      explorerUrl: string;
    }>(`/solana/wallet?address=${encodeURIComponent(address)}`),
  register: (email: string, password: string, displayName?: string) =>
    request<{ accessToken: string; user: { id: string; email: string; displayName: string | null } }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password, displayName }) },
    ),
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: { id: string; email: string; displayName: string | null } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
  watchlist: async () => {
    if (!isLoggedIn()) {
      const items = readGuestWatch().map((w, i) => ({
        id: `guest-${i}`,
        coingeckoId: w.coingeckoId,
        symbol: w.symbol,
        name: w.name,
      }));
      return { items, mode: 'guest' as const };
    }
    const res = await request<{
      items: Array<{ id: string; coingeckoId: string; symbol: string; name: string }>;
    }>('/watchlist');
    return { ...res, mode: 'account' as const };
  },
  addWatch: async (coingeckoId: string, meta?: { symbol: string; name: string }) => {
    if (!isLoggedIn()) {
      const items = readGuestWatch().filter((w) => w.coingeckoId !== coingeckoId);
      items.unshift({
        coingeckoId,
        symbol: (meta?.symbol || coingeckoId).toUpperCase(),
        name: meta?.name || coingeckoId,
      });
      writeGuestWatch(items.slice(0, 50));
      return { ok: true, mode: 'guest' as const };
    }
    await request('/watchlist', { method: 'POST', body: JSON.stringify({ coingeckoId }) });
    return { ok: true, mode: 'account' as const };
  },
  removeWatch: async (coingeckoId: string) => {
    if (!isLoggedIn()) {
      writeGuestWatch(readGuestWatch().filter((w) => w.coingeckoId !== coingeckoId));
      return { ok: true };
    }
    return request(`/watchlist/${encodeURIComponent(coingeckoId)}`, { method: 'DELETE' });
  },
  isWatched: async (coingeckoId: string) => {
    const { items } = await api.watchlist();
    return items.some((i) => i.coingeckoId === coingeckoId);
  },
  signals: (style = 'balanced') =>
    request<{
      style: string;
      source?: string;
      weights?: Record<string, number>;
      disclaimer: string;
      signals: TradingSignal[];
    }>(`/signals?style=${encodeURIComponent(style)}`),
  smartMoneyWallets: () =>
    request<{
      wallets: Array<{
        id: string;
        address: string;
        chain: string;
        label: string | null;
        source: string;
        winRate: number;
        totalPnL: number;
        smartMoneyScore: number;
        bestToken: string | null;
        totalTrades: number;
        lastIngestAt: string | null;
      }>;
    }>('/smart-money/wallets'),
  smartMoneySignals: (windowMinutes = 30) =>
    request<{
      signals: Array<{
        symbol: string;
        coingeckoId: string | null;
        score: number;
        summary: string;
        wallets: Array<{
          label: string | null;
          address: string;
          winRate: number;
          totalPnL: number;
          smartMoneyScore: number;
          side: string;
          at: string;
        }>;
        windowMinutes: number;
        generatedAt: string;
      }>;
    }>(`/smart-money/signals?window=${windowMinutes}`),
  smartMoneyEvents: (limit = 40) =>
    request<{
      events: Array<{
        chain: string;
        signature: string;
        wallet: string;
        label: string | null;
        token: string;
        tokenSymbol: string | null;
        type: string;
        amount: number;
        valueUsd: number | null;
        timestamp: string;
      }>;
      pipeline: string[];
    }>(`/smart-money/events?limit=${limit}`),
  smartMoneyIngest: () =>
    request<{ ok: boolean; message: string }>('/smart-money/ingest', { method: 'POST' }),
  portfolio: () =>
    request<{
      positions: Array<{
        id: string;
        coingeckoId: string;
        symbol: string;
        name: string;
        quantity: number;
        avgCostUsd: number;
        price: number | null;
        marketValue: number | null;
        cost: number;
        pnl: number | null;
        pnlPct: number | null;
        change24h: number | null;
        image: string | null;
      }>;
      summary: { marketValue: number; cost: number; pnl: number; pnlPct: number; count: number };
    }>('/portfolio'),
  addPosition: (coingeckoId: string, quantity: number, avgCostUsd: number) =>
    request('/portfolio', {
      method: 'POST',
      body: JSON.stringify({ coingeckoId, quantity, avgCostUsd }),
    }),
  removePosition: (id: string) => request(`/portfolio/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  alerts: () =>
    request<{
      alerts: Array<{
        id: string;
        coingeckoId: string;
        symbol: string;
        name: string;
        direction: 'above' | 'below';
        targetPrice: number;
        active: boolean;
        currentPrice: number | null;
        status: string;
        triggeredAt?: string | null;
        createdAt: string;
      }>;
      telegram?: { botConfigured: boolean; pollHint: string };
    }>('/alerts'),
  createAlert: (coingeckoId: string, direction: 'above' | 'below', targetPrice: number) =>
    request('/alerts', {
      method: 'POST',
      body: JSON.stringify({ coingeckoId, direction, targetPrice }),
    }),
  removeAlert: (id: string) => request(`/alerts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  settings: () =>
    request<{
      userId: string;
      displayName: string | null;
      defaultTimeframe: string;
      riskTolerance: 'low' | 'medium' | 'high';
      emailAlerts: boolean;
      telegramAlerts: boolean;
      telegramChatId: string | null;
      telegramBotConfigured?: boolean;
      telegramBotUsername?: string | null;
      telegramBotOk?: boolean;
      signalStyle: 'conservative' | 'balanced' | 'aggressive';
      currency: string;
      updatedAt: string;
    }>('/settings'),
  updateSettings: (patch: Record<string, unknown>) =>
    request('/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
  testTelegram: (chatId?: string) =>
    request<{ ok: boolean; chatId?: string }>('/settings/telegram/test', {
      method: 'POST',
      body: JSON.stringify({ chatId }),
    }),
  telegramChats: () =>
    request<{
      configured: boolean;
      chats: Array<{ chatId: string; name: string }>;
    }>('/settings/telegram/chats'),
  copyLeaders: () =>
    request<{ disclaimer: string; leaders: CopyLeader[] }>('/copy-trading/leaders'),
  copyFollows: () =>
    request<{
      follows: Array<{
        id: string;
        traderId: string;
        allocationPct: number;
        trader: CopyLeader | null;
      }>;
    }>('/copy-trading/follows'),
  followTrader: (traderId: string, allocationPct: number) =>
    request('/copy-trading/follow', {
      method: 'POST',
      body: JSON.stringify({ traderId, allocationPct }),
    }),
  unfollowTrader: (traderId: string) =>
    request(`/copy-trading/follow/${encodeURIComponent(traderId)}`, { method: 'DELETE' }),
  copyTrades: () =>
    request<{
      trades: Array<{
        id: string;
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
      }>;
    }>('/copy-trading/trades'),
};

export function formatUsd(n: number, digits = 2) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
  return `$${n.toPrecision(4)}`;
}

export function formatPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}
