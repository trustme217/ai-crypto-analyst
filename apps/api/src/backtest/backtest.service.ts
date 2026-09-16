import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { BACKTEST_HORIZONS, pctReturn, scoreBucket, type HorizonKey } from './backtest.util';

export type ObserveInput = {
  coingeckoId: string;
  symbol: string;
  name: string;
  score: number;
  price: number;
  source?: string;
  at?: Date;
  fingerprint?: string;
};

@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);
  private seeded = false;

  constructor(private readonly prisma: PrismaService) {}

  async observe(input: ObserveInput) {
    if (!(input.price > 0) || input.score == null || !Number.isFinite(input.score)) return null;
    const hour = Math.floor((input.at ?? new Date()).getTime() / 3_600_000);
    const fingerprint =
      input.fingerprint || `${input.source || 'token-score'}:${input.coingeckoId}:${hour}`;
    await this.writePrice({
      coingeckoId: input.coingeckoId,
      symbol: input.symbol,
      price: input.price,
      capturedAt: input.at,
    });
    const existing = await this.prisma.scoredSignal.findUnique({ where: { fingerprint } });
    if (existing) return existing;
    try {
      return await this.prisma.scoredSignal.create({
        data: {
          coingeckoId: input.coingeckoId,
          symbol: input.symbol.toUpperCase(),
          name: input.name,
          score: input.score,
          signalPrice: input.price,
          source: input.source || 'token-score',
          fingerprint,
          createdAt: input.at ?? new Date(),
        },
      });
    } catch {
      return this.prisma.scoredSignal.findUnique({ where: { fingerprint } });
    }
  }

  async writePrice(input: {
    coingeckoId: string;
    symbol: string;
    price: number;
    volume24h?: number | null;
    marketCap?: number | null;
    capturedAt?: Date;
  }) {
    if (!(input.price > 0) || !input.coingeckoId) return;
    const at = input.capturedAt ?? new Date();
    const recent = await this.prisma.tokenPricePoint.findFirst({
      where: { coingeckoId: input.coingeckoId, capturedAt: { gte: new Date(at.getTime() - 45_000) } },
      orderBy: { capturedAt: 'desc' },
    });
    if (recent) return recent;
    return this.prisma.tokenPricePoint.create({
      data: {
        coingeckoId: input.coingeckoId,
        symbol: input.symbol.toUpperCase(),
        price: input.price,
        volume24h: input.volume24h ?? null,
        marketCap: input.marketCap ?? null,
        capturedAt: at,
      },
    });
  }

  async seedFromSnapshots() {
    const snaps = await this.prisma.tokenMetricSnapshot.findMany({
      orderBy: { capturedAt: 'asc' },
      take: 400,
    });
    let n = 0;
    for (const s of snaps) {
      const row = await this.observe({
        coingeckoId: s.coingeckoId,
        symbol: s.symbol,
        name: s.name,
        score: s.tokenScore,
        price: s.price,
        source: 'token-score',
        at: s.capturedAt,
        fingerprint: `snapshot:${s.id}`,
      });
      if (row) n += 1;
      await this.writePrice({
        coingeckoId: s.coingeckoId,
        symbol: s.symbol,
        price: s.price,
        volume24h: s.volume24h,
        marketCap: s.marketCap,
        capturedAt: s.capturedAt,
      });
    }
    this.logger.log(`Backtest seeded ${n} scored signals from metric snapshots`);
    return n;
  }

  async fillDue(limit = 200) {
    if (!this.seeded) {
      await this.seedFromSnapshots();
      this.seeded = true;
    }

    const rows = await this.prisma.scoredSignal.findMany({
      where: {
        OR: [
          { ret5m: null },
          { ret15m: null },
          { ret1h: null },
          { ret6h: null },
          { ret24h: null },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let filled = 0;
    const now = Date.now();
    for (const row of rows) {
      const patch: Record<string, number> = {};
      for (const h of BACKTEST_HORIZONS) {
        if (row[h.ret] != null) continue;
        const target = row.createdAt.getTime() + h.ms;
        if (target > now) continue;
        const later = await this.priceNear(row.coingeckoId, new Date(target), h.slackMs);
        if (later == null) continue;
        const ret = pctReturn(row.signalPrice, later);
        if (ret == null) continue;
        patch[h.ret] = ret;
        patch[h.price] = later;
      }
      if (!Object.keys(patch).length) continue;
      await this.prisma.scoredSignal.update({ where: { id: row.id }, data: patch });
      filled += 1;
    }
    if (filled) this.logger.log(`Backtest filled ${filled} signal(s)`);
    return filled;
  }

  async summary() {
    await this.fillDue();
    const rows = await this.prisma.scoredSignal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    const bucketMap = new Map<
      string,
      {
        min: number;
        max: number;
        label: string;
        count: number;
        sums: Record<HorizonKey, number>;
        filled: Record<HorizonKey, number>;
      }
    >();

    for (const r of rows) {
      const b = scoreBucket(r.score);
      let agg = bucketMap.get(b.label);
      if (!agg) {
        agg = {
          min: b.min,
          max: b.max,
          label: b.label,
          count: 0,
          sums: { '5m': 0, '15m': 0, '1h': 0, '6h': 0, '24h': 0 },
          filled: { '5m': 0, '15m': 0, '1h': 0, '6h': 0, '24h': 0 },
        };
        bucketMap.set(b.label, agg);
      }
      agg.count += 1;
      for (const h of BACKTEST_HORIZONS) {
        const v = r[h.ret];
        if (v == null) continue;
        agg.sums[h.key] += v;
        agg.filled[h.key] += 1;
      }
    }

    const buckets = [...bucketMap.values()]
      .sort((a, b) => b.min - a.min)
      .map((b) => ({
        range: b.label,
        min: b.min,
        max: b.max,
        count: b.count,
        avg: Object.fromEntries(
          BACKTEST_HORIZONS.map((h) => [
            h.key,
            b.filled[h.key] ? Math.round((b.sums[h.key] / b.filled[h.key]) * 10) / 10 : null,
          ]),
        ) as Record<HorizonKey, number | null>,
        filled: b.filled,
      }));

    return {
      totalSignals: rows.length,
      target: 1000,
      horizons: BACKTEST_HORIZONS.map((h) => h.key),
      buckets,
      recent: rows.slice(0, 40).map((r) => this.toJson(r)),
      disclaimer:
        'Forward returns vs recorded signal price. Deterministic Token Score — paper only, not advice. Horizons fill as sampled prices arrive.',
    };
  }

  async list(limit = 50) {
    const rows = await this.prisma.scoredSignal.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
    return { signals: rows.map((r) => this.toJson(r)) };
  }

  private toJson(r: {
    id: string;
    coingeckoId: string;
    symbol: string;
    name: string;
    score: number;
    signalPrice: number;
    source: string;
    ret5m: number | null;
    ret15m: number | null;
    ret1h: number | null;
    ret6h: number | null;
    ret24h: number | null;
    price5m: number | null;
    price15m: number | null;
    price1h: number | null;
    price6h: number | null;
    price24h: number | null;
    createdAt: Date;
  }) {
    return {
      id: r.id,
      coingeckoId: r.coingeckoId,
      symbol: r.symbol,
      name: r.name,
      score: r.score,
      signalPrice: r.signalPrice,
      source: r.source,
      returns: {
        '5m': r.ret5m,
        '15m': r.ret15m,
        '1h': r.ret1h,
        '6h': r.ret6h,
        '24h': r.ret24h,
      },
      prices: {
        '5m': r.price5m,
        '15m': r.price15m,
        '1h': r.price1h,
        '6h': r.price6h,
        '24h': r.price24h,
      },
      bucket: scoreBucket(r.score).label,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private async priceNear(coingeckoId: string, target: Date, slackMs: number): Promise<number | null> {
    const lo = new Date(target.getTime() - slackMs);
    const hi = new Date(target.getTime() + slackMs);
    const points = await this.prisma.tokenPricePoint.findMany({
      where: { coingeckoId, capturedAt: { gte: lo, lte: hi } },
      select: { price: true, capturedAt: true },
    });
    let best: { price: number; d: number } | null = null;
    for (const p of points) {
      const d = Math.abs(p.capturedAt.getTime() - target.getTime());
      if (!best || d < best.d) best = { price: p.price, d };
    }
    if (best) return best.price;

    const snaps = await this.prisma.tokenMetricSnapshot.findMany({
      where: { coingeckoId, capturedAt: { gte: lo, lte: hi } },
      select: { price: true, capturedAt: true },
    });
    for (const p of snaps) {
      const d = Math.abs(p.capturedAt.getTime() - target.getTime());
      if (!best || d < best.d) best = { price: p.price, d };
    }
    return best?.price ?? null;
  }
}
