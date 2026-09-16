import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { SmartMoneyService } from '../smart-money/smart-money.service';
import { MarketService } from '../market/market.service';
import {
  DEFAULT_STRATEGIES,
  matchConditions,
  type StrategyConditions,
  type StrategyFacts,
} from './strategy.types';

@Injectable()
export class StrategyService implements OnModuleInit {
  private readonly logger = new Logger(StrategyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smart: SmartMoneyService,
    private readonly market: MarketService,
  ) {}

  async onModuleInit() {
    try {
      await this.seedDefaults();
      await this.backfillBooks();
    } catch (err) {
      this.logger.warn(`Strategy seed skipped: ${(err as Error).message}`);
    }
  }

  async seedDefaults() {
    for (const s of DEFAULT_STRATEGIES) {
      const exists = await this.prisma.strategy.findUnique({ where: { slug: s.slug } });
      if (exists) continue;
      await this.prisma.strategy.create({
        data: {
          name: s.name,
          slug: s.slug,
          conditionsJson: JSON.stringify(s.conditions),
          side: s.side,
          maxRiskScore: s.maxRiskScore,
          notionalUsd: s.notionalUsd,
          active: true,
        },
      });
      this.logger.log(`Seeded strategy ${s.name}`);
    }
  }

  async list() {
    const rows = await this.prisma.strategy.findMany({ orderBy: { createdAt: 'asc' } });
    const fills = await this.prisma.strategyFill.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { strategy: { select: { name: true, slug: true } } },
    });
    const books = await this.books();
    return {
      flow: [
        'Smart Money Signal',
        'Token Score',
        'AI Analysis',
        'Strategy',
        'Risk Engine',
        'Paper Trade',
        'Position',
        'PnL',
      ],
      compare: ['AI-only', 'Momentum', 'Smart-money', 'Smart-money + AI'],
      disclaimer:
        'Paper books only. Fills follow Smart Money → Token Score → AI Analysis → Strategy → Risk Engine → Position → PnL. Compare strategies without real money.',
      strategies: rows.map((r) => this.toJson(r)),
      fills: fills.map((f) => this.fillJson(f)),
      books,
    };
  }

  async create(input: {
    name: string;
    conditions: StrategyConditions;
    side?: 'long' | 'short';
    maxRiskScore?: number;
    notionalUsd?: number;
    active?: boolean;
  }) {
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || `strategy-${Date.now()}`;
    const row = await this.prisma.strategy.create({
      data: {
        name: input.name,
        slug: `${slug}-${Math.floor(Math.random() * 999)}`,
        conditionsJson: JSON.stringify(input.conditions || {}),
        side: input.side || 'long',
        maxRiskScore: input.maxRiskScore ?? 70,
        notionalUsd: input.notionalUsd ?? 250,
        active: input.active !== false,
      },
    });
    return this.toJson(row);
  }

  async consider(facts: StrategyFacts): Promise<{ matched: string[]; filled: string[]; skipped: string[] }> {
    const strategies = await this.prisma.strategy.findMany({ where: { active: true } });
    const matched: string[] = [];
    const filled: string[] = [];
    const skipped: string[] = [];

    for (const s of strategies) {
      let conditions: StrategyConditions = {};
      try {
        conditions = JSON.parse(s.conditionsJson) as StrategyConditions;
      } catch {
        skipped.push(`${s.name}: invalid JSON`);
        continue;
      }
      const hit = matchConditions(facts, conditions);
      if (!hit.ok) continue;
      matched.push(s.name);

      if (facts.riskScore > s.maxRiskScore) {
        skipped.push(`${s.name}: Risk Engine ${facts.riskScore} > max ${s.maxRiskScore}`);
        continue;
      }
      if (!(facts.price > 0)) {
        skipped.push(`${s.name}: no price`);
        continue;
      }

      const hour = Math.floor(Date.now() / 3_600_000);
      const fingerprint = `${s.id}:${facts.coingeckoId}:${hour}`;
      const existing = await this.prisma.strategyFill.findUnique({ where: { fingerprint } });
      if (existing) {
        skipped.push(`${s.name}: already filled this hour`);
        continue;
      }

      const notional = s.notionalUsd;
      const quantity = notional / facts.price;
      const side = s.side === 'short' ? 'sell' : 'buy';
      try {
        await this.prisma.strategyFill.create({
          data: {
            strategyId: s.id,
            coingeckoId: facts.coingeckoId,
            symbol: facts.symbol.toUpperCase(),
            name: facts.name,
            side,
            quantity,
            priceUsd: facts.price,
            notionalUsd: notional,
            tokenScore: facts.tokenScore,
            smartMoneyScore: facts.smartMoneyScore,
            riskScore: facts.riskScore,
            aiScore: Number.isFinite(facts.aiScore) ? facts.aiScore : null,
            fingerprint,
            note:
              `${s.name} matched. Risk Engine ${facts.riskScore}/100 (max ${s.maxRiskScore}). ` +
              `Paper ${side} ${notional} USD. Not live.`,
          },
        });
        await this.applyFillToBook({
          strategyId: s.id,
          coingeckoId: facts.coingeckoId,
          symbol: facts.symbol.toUpperCase(),
          name: facts.name,
          side,
          quantity,
          priceUsd: facts.price,
          notionalUsd: notional,
        });
        filled.push(s.name);
        this.logger.log(`Paper fill ${s.name} ${facts.symbol} @ ${facts.price}`);
      } catch {
        skipped.push(`${s.name}: duplicate fill`);
      }
    }

    return { matched, filled, skipped };
  }

  async runLatest() {
    const snaps = await this.prisma.tokenMetricSnapshot.findMany({
      orderBy: { capturedAt: 'desc' },
      take: 60,
    });
    const seen = new Set<string>();
    const results: Array<{ symbol: string; matched: string[]; filled: string[]; skipped: string[] }> = [];
    for (const s of snaps) {
      if (seen.has(s.coingeckoId)) continue;
      seen.add(s.coingeckoId);
      const sm = await this.smart.scoreForSymbol(s.symbol, 60);
      const analysis = await this.prisma.analysisReport.findFirst({
        where: { coingeckoId: s.coingeckoId },
        orderBy: { createdAt: 'desc' },
      });
      const out = await this.consider({
        coingeckoId: s.coingeckoId,
        symbol: s.symbol,
        name: s.name,
        price: s.price,
        tokenScore: s.tokenScore,
        smartMoneyScore: sm ?? Number.NaN,
        liquidityScore: s.liquidityScore,
        liquidity: s.volume24h,
        volume24h: s.volume24h,
        marketCap: s.marketCap,
        momentum: 50,
        holderQuality: 50,
        riskScore: s.riskScore,
        aiScore: analysis?.score,
      });
      results.push({ symbol: s.symbol, ...out });
    }
    const desk = await this.list();
    return { ok: true, evaluated: results.length, results, ...desk };
  }

  async backfillBooks() {
    const posCount = await this.prisma.strategyPosition.count();
    if (posCount > 0) return;
    const fills = await this.prisma.strategyFill.findMany({ orderBy: { createdAt: 'asc' } });
    for (const f of fills) {
      await this.applyFillToBook(f);
    }
    if (fills.length) this.logger.log(`Backfilled ${fills.length} fills into strategy books`);
  }

  async applyFillToBook(fill: {
    strategyId: string;
    coingeckoId: string;
    symbol: string;
    name: string;
    side: string;
    quantity: number;
    priceUsd: number;
    notionalUsd: number;
  }) {
    const existing = await this.prisma.strategyPosition.findUnique({
      where: { strategyId_coingeckoId: { strategyId: fill.strategyId, coingeckoId: fill.coingeckoId } },
    });
    if (fill.side === 'buy') {
      const quantity = (existing?.quantity || 0) + fill.quantity;
      const avgCostUsd =
        quantity > 0
          ? ((existing?.quantity || 0) * (existing?.avgCostUsd || 0) + fill.notionalUsd) / quantity
          : fill.priceUsd;
      await this.prisma.strategyPosition.upsert({
        where: { strategyId_coingeckoId: { strategyId: fill.strategyId, coingeckoId: fill.coingeckoId } },
        create: {
          strategyId: fill.strategyId,
          coingeckoId: fill.coingeckoId,
          symbol: fill.symbol,
          name: fill.name,
          quantity,
          avgCostUsd,
          realizedPnl: existing?.realizedPnl || 0,
        },
        update: { quantity, avgCostUsd, symbol: fill.symbol, name: fill.name },
      });
      return;
    }
    if (!existing || existing.quantity <= 0) return;
    const sellQty = Math.min(existing.quantity, fill.quantity);
    const realizedPnl = existing.realizedPnl + (fill.priceUsd - existing.avgCostUsd) * sellQty;
    const remain = existing.quantity - sellQty;
    if (remain <= 1e-12) {
      await this.prisma.strategyPosition.delete({ where: { id: existing.id } });
      return;
    }
    await this.prisma.strategyPosition.update({
      where: { id: existing.id },
      data: { quantity: remain, realizedPnl },
    });
  }

  async books() {
    const strategies = await this.prisma.strategy.findMany({
      orderBy: { createdAt: 'asc' },
      include: { positions: true, _count: { select: { fills: true } } },
    });
    const ids = [...new Set(strategies.flatMap((s) => s.positions.map((p) => p.coingeckoId)))];
    const prices = await this.lastPrices(ids);
    return strategies.map((s) => {
      let cost = 0;
      let value = 0;
      const positions = s.positions.map((p) => {
        const price = prices[p.coingeckoId] ?? p.avgCostUsd;
        const marketValue = price * p.quantity;
        const posCost = p.avgCostUsd * p.quantity;
        const unrealized = marketValue - posCost;
        cost += posCost;
        value += marketValue;
        return {
          coingeckoId: p.coingeckoId,
          symbol: p.symbol,
          name: p.name,
          quantity: p.quantity,
          avgCostUsd: p.avgCostUsd,
          price,
          marketValue,
          pnl: unrealized + p.realizedPnl,
          pnlPct: posCost > 0 ? ((unrealized + p.realizedPnl) / posCost) * 100 : 0,
        };
      });
      const realized = s.positions.reduce((a, p) => a + p.realizedPnl, 0);
      const pnl = value - cost + realized;
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        fills: s._count.fills,
        positions,
        cost,
        value,
        realizedPnl: realized,
        pnl,
        pnlPct: cost > 0 ? (pnl / cost) * 100 : 0,
      };
    });
  }

  private async lastPrices(ids: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    if (!ids.length) return out;
    for (const id of ids) {
      const pt = await this.prisma.tokenPricePoint.findFirst({
        where: { coingeckoId: id },
        orderBy: { capturedAt: 'desc' },
      });
      if (pt) out[id] = pt.price;
    }
    const missing = ids.filter((id) => out[id] == null);
    if (missing.length) {
      try {
        Object.assign(out, await this.market.getSimplePrices(missing));
      } catch {
        /* sampled prices only */
      }
    }
    return out;
  }

  private toJson(r: {
    id: string;
    name: string;
    slug: string;
    conditionsJson: string;
    side: string;
    maxRiskScore: number;
    notionalUsd: number;
    active: boolean;
    createdAt: Date;
  }) {
    let conditions: StrategyConditions = {};
    try {
      conditions = JSON.parse(r.conditionsJson) as StrategyConditions;
    } catch {
      conditions = {};
    }
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      definition: { name: r.name, conditions } satisfies { name: string; conditions: StrategyConditions },
      side: r.side,
      maxRiskScore: r.maxRiskScore,
      notionalUsd: r.notionalUsd,
      active: r.active,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private fillJson(f: {
    id: string;
    strategyId: string;
    coingeckoId: string;
    symbol: string;
    name: string;
    side: string;
    quantity: number;
    priceUsd: number;
    notionalUsd: number;
    tokenScore: number;
    smartMoneyScore: number;
    riskScore: number;
    aiScore?: number | null;
    note: string | null;
    createdAt: Date;
    strategy?: { name: string; slug: string };
  }) {
    return {
      id: f.id,
      strategyId: f.strategyId,
      strategyName: f.strategy?.name || f.strategyId,
      coingeckoId: f.coingeckoId,
      symbol: f.symbol,
      name: f.name,
      side: f.side,
      quantity: f.quantity,
      priceUsd: f.priceUsd,
      notionalUsd: f.notionalUsd,
      tokenScore: f.tokenScore,
      smartMoneyScore: f.smartMoneyScore,
      riskScore: f.riskScore,
      aiScore: f.aiScore ?? null,
      note: f.note,
      createdAt: f.createdAt.toISOString(),
    };
  }
}
