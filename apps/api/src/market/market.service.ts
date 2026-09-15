import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type MarketCoin = {
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
};

type CacheEntry = { at: number; data: unknown };

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<unknown>>();
  /** Fresh window — serve without refetch */
  private readonly freshTtlMs = 120_000;
  /** Stale window — still serve on error / while refreshing */
  private readonly staleTtlMs = 15 * 60_000;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>('COINGECKO_BASE_URL') ||
      'https://api.coingecko.com/api/v3';
    this.apiKey = this.config.get<string>('COINGECKO_API_KEY') || undefined;
  }

  async getOverview(limit = 20) {
    const perPage = Math.min(Math.max(limit, 8), 50);
    return this.getCached(`overview:top:${perPage}`, async () => {
      const url =
        `${this.baseUrl}/coins/markets?vs_currency=usd` +
        `&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=true` +
        `&price_change_percentage=24h,7d`;
      type MarketRow = MarketCoin & {
        price_change_percentage_7d_in_currency?: number | null;
      };
      const markets = await this.fetchJson<MarketRow[]>(url);
      let global: {
        data: {
          total_market_cap: { usd: number };
          total_volume: { usd: number };
          market_cap_percentage: { btc: number; eth: number };
          market_cap_change_percentage_24h_usd: number;
        };
      };
      try {
        global = await this.fetchJson(`${this.baseUrl}/global`);
      } catch {
        global = {
          data: {
            total_market_cap: { usd: markets.reduce((s, c) => s + (c.market_cap || 0), 0) },
            total_volume: { usd: markets.reduce((s, c) => s + (c.total_volume || 0), 0) },
            market_cap_percentage: { btc: 0, eth: 0 },
            market_cap_change_percentage_24h_usd: 0,
          },
        };
      }
      return {
        global: {
          marketCap: global.data.total_market_cap.usd,
          volume24h: global.data.total_volume.usd,
          btcDominance: global.data.market_cap_percentage.btc,
          ethDominance: global.data.market_cap_percentage.eth,
          marketCapChange24h: global.data.market_cap_change_percentage_24h_usd,
        },
        coins: markets,
      };
    });
  }

  async search(query: string) {
    const q = query.trim();
    if (!q) return { coins: [] };
    return this.getCached(`search:${q.toLowerCase()}`, async () => {
      const data = await this.fetchJson<{
        coins: Array<{
          id: string;
          name: string;
          symbol: string;
          market_cap_rank: number | null;
          thumb: string;
        }>;
      }>(`${this.baseUrl}/search?query=${encodeURIComponent(q)}`);
      return { coins: data.coins.slice(0, 12) };
    });
  }

  async getCoin(id: string) {
    try {
      return await this.getCached(`coin:${id}`, async () => this.fetchCoinDetail(id));
    } catch (err) {
      const fallback = this.coinFromOverviewCache(id);
      if (fallback) {
        this.logger.warn(`Serving stale/overview fallback for ${id} after market fetch failure`);
        return fallback;
      }
      throw err;
    }
  }

  /** Batch USD prices for alert polling (CoinGecko /simple/price). */
  async getSimplePrices(ids: string[]): Promise<Record<string, number>> {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (!unique.length) return {};
    const key = `simple:${unique.slice().sort().join(',')}`;
    return this.getCached(key, async () => {
      const url =
        `${this.baseUrl}/simple/price?ids=${encodeURIComponent(unique.join(','))}` +
        `&vs_currencies=usd`;
      const data = await this.fetchJson<Record<string, { usd?: number }>>(url);
      const out: Record<string, number> = {};
      for (const id of unique) {
        const usd = data[id]?.usd;
        if (typeof usd === 'number') out[id] = usd;
      }
      return out;
      });
  }

  private async fetchCoinDetail(id: string) {
    const url =
      `${this.baseUrl}/coins/${encodeURIComponent(id)}` +
      `?localization=false&tickers=false&market_data=true&community_data=false` +
      `&developer_data=false&sparkline=true`;
    const coin = await this.fetchJson<{
      id: string;
      symbol: string;
      name: string;
      image: { large: string; small: string };
      description: { en: string };
      links: { homepage: string[]; twitter_screen_name: string };
      market_data: {
        current_price: { usd: number };
        market_cap: { usd: number };
        total_volume: { usd: number };
        high_24h: { usd: number };
        low_24h: { usd: number };
        price_change_percentage_24h: number;
        price_change_percentage_7d: number;
        price_change_percentage_30d: number;
        circulating_supply: number;
        ath: { usd: number };
        ath_change_percentage: { usd: number };
        sparkline_7d?: { price: number[] };
      };
      categories: string[];
    }>(url);

    return {
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image.large || coin.image.small,
      description: (coin.description?.en || '').replace(/<[^>]+>/g, '').slice(0, 1200),
      homepage: coin.links?.homepage?.[0] || null,
      twitter: coin.links?.twitter_screen_name || null,
      categories: coin.categories?.slice(0, 6) || [],
      market: {
        price: coin.market_data.current_price.usd,
        marketCap: coin.market_data.market_cap.usd,
        volume24h: coin.market_data.total_volume.usd,
        high24h: coin.market_data.high_24h.usd,
        low24h: coin.market_data.low_24h.usd,
        change24h: coin.market_data.price_change_percentage_24h,
        change7d: coin.market_data.price_change_percentage_7d,
        change30d: coin.market_data.price_change_percentage_30d,
        circulatingSupply: coin.market_data.circulating_supply,
        ath: coin.market_data.ath.usd,
        athChange: coin.market_data.ath_change_percentage.usd,
        sparkline: coin.market_data.sparkline_7d?.price || [],
      },
    };
  }

  private coinFromOverviewCache(id: string) {
    for (const [key, entry] of this.cache.entries()) {
      if (!key.startsWith('overview:')) continue;
      const overview = entry.data as { coins?: MarketCoin[] };
      const c = overview.coins?.find((x) => x.id === id);
      if (!c) continue;
      return {
        id: c.id,
        symbol: c.symbol,
        name: c.name,
        image: c.image,
        description: 'Cached market snapshot (CoinGecko rate limit). Retry shortly for full detail.',
        homepage: null,
        twitter: null,
        categories: [] as string[],
        market: {
          price: c.current_price,
          marketCap: c.market_cap,
          volume24h: c.total_volume,
          high24h: c.current_price,
          low24h: c.current_price,
          change24h: c.price_change_percentage_24h ?? 0,
          change7d: 0,
          change30d: 0,
          circulatingSupply: 0,
          ath: c.current_price,
          athChange: 0,
          sparkline: c.sparkline_in_7d?.price || [],
        },
      };
    }
    return null;
  }

  private async getCached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    const age = hit ? Date.now() - hit.at : Infinity;
    if (hit && age < this.freshTtlMs) return hit.data as T;

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = (async () => {
      try {
        const data = await loader();
        this.cache.set(key, { at: Date.now(), data });
        return data;
      } catch (err) {
        if (hit && age < this.staleTtlMs) {
          this.logger.warn(`Using stale cache for ${key}`);
          return hit.data as T;
        }
        throw err;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return promise;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'ai-crypto-analyst-mvp',
    };
    if (this.apiKey) {
      headers['x-cg-demo-api-key'] = this.apiKey;
      headers['x-cg-pro-api-key'] = this.apiKey;
    }

    let lastStatus = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, { headers });
      lastStatus = res.status;
      if (res.ok) return (await res.json()) as T;

      if (res.status === 429 || res.status >= 500) {
        const wait = 800 * Math.pow(2, attempt) + Math.floor(Math.random() * 400);
        this.logger.warn(`CoinGecko ${res.status} — retry in ${wait}ms (${url})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      throw new HttpException(`Market data error (${res.status})`, HttpStatus.BAD_GATEWAY);
    }

    throw new HttpException(
      lastStatus === 429
        ? 'CoinGecko rate limit hit. Wait a few seconds and retry, or set COINGECKO_API_KEY.'
        : `Market data error (${lastStatus})`,
      lastStatus === 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_GATEWAY,
    );
  }
}
