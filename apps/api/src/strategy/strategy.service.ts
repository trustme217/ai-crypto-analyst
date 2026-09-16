import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { SmartMoneyService } from '../smart-money/smart-money.service';
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
  ) {}

  async onModuleInit() {
    try {
      await this.seedDefaults();
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
    return {
      flow: ['Signal', 'Strategy', 'Risk Engine', 'Paper Trade'],
      disclaimer: 'JSON conditions are deterministic. Risk Engine gates paper fills. No live orders.',
      strategies: rows.map((r) => this.toJson(r)),
      fills: fills.map((f) => this.fillJson(f)),
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
            fingerprint,
            note:
              `${s.name} matched. Risk Engine ${facts.riskScore}/100 (max ${s.maxRiskScore}). ` +
              `Paper ${side} ${notional} USD. Not live.`,
          },
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
      });
      results.push({ symbol: s.symbol, ...out });
    }
    const desk = await this.list();
    return { ok: true, evaluated: results.length, results, ...desk };
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
      note: f.note,
      createdAt: f.createdAt.toISOString(),
    };
  }
}
