import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

/** Component scores shown in the Risk Engine table (0–100). */
export type TokenRiskBreakdown = {
  liquidity: number;
  holderConcentration: number;
  creatorHoldings: number;
  sellPressure: number;
  volumeAnomaly: number;
  contractRisk: number;
};

export type TokenRiskReport = {
  token: string;
  coingeckoId: string;
  /** Higher = riskier. Composite, not LLM. */
  riskScore: number;
  liquidityScore: number;
  holderScore: number;
  creatorScore: number;
  sellPressure: number;
  volumeAnomaly: number;
  contractRisk: number;
  breakdown: TokenRiskBreakdown;
  weights: {
    liquidity: number;
    holderConcentration: number;
    creatorHoldings: number;
    sellPressure: number;
    volumeAnomaly: number;
    contractRisk: number;
  };
  source: 'risk-engine';
  generatedAt: string;
};

export type RiskEngineInput = {
  coingeckoId: string;
  symbol: string;
  marketCap: number;
  volume24h: number;
  change24h: number;
  change7d?: number | null;
  categories?: string[];
  holderConcentration?: number | null;
  creatorOwnership?: number | null;
};

const RISK_WEIGHTS = {
  liquidity: 0.2,
  holderConcentration: 0.2,
  creatorHoldings: 0.15,
  sellPressure: 0.2,
  volumeAnomaly: 0.1,
  contractRisk: 0.15,
} as const;

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function round0(n: number) {
  return Math.round(n);
}

@Injectable()
export class RiskEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deterministic risk before AI. Higher component scores mean more of that factor;
   * liquidityScore is inverted internally (high liquidity lowers riskScore).
   */
  async evaluate(input: RiskEngineInput): Promise<TokenRiskReport> {
    const volMcap = input.marketCap > 0 ? input.volume24h / input.marketCap : 0;
    const c24 = input.change24h;
    const c7 = input.change7d ?? 0;
    const cats = (input.categories || []).map((c) => c.toLowerCase());

    const liquidity = this.liquidityScore(input.marketCap, input.volume24h, volMcap);
    const holderConcentration = round0(
      clamp(input.holderConcentration ?? this.proxyConcentration(input.marketCap)),
    );
    const creatorHoldings = round0(
      clamp(input.creatorOwnership ?? this.proxyCreator(input.marketCap, cats)),
    );
    const sellPressure = await this.sellPressureScore(input.symbol, c24, c7, volMcap);
    const volumeAnomaly = this.volumeAnomalyScore(volMcap, c24);
    const contractRisk = this.contractRiskScore(input.marketCap, cats, creatorHoldings, holderConcentration);

    const riskScore = round0(
      clamp(
        (100 - liquidity) * RISK_WEIGHTS.liquidity +
          holderConcentration * RISK_WEIGHTS.holderConcentration +
          creatorHoldings * RISK_WEIGHTS.creatorHoldings +
          sellPressure * RISK_WEIGHTS.sellPressure +
          volumeAnomaly * RISK_WEIGHTS.volumeAnomaly +
          contractRisk * RISK_WEIGHTS.contractRisk,
      ),
    );

    return {
      token: input.symbol.toUpperCase(),
      coingeckoId: input.coingeckoId,
      riskScore,
      liquidityScore: liquidity,
      holderScore: holderConcentration,
      creatorScore: creatorHoldings,
      sellPressure,
      volumeAnomaly,
      contractRisk,
      breakdown: {
        liquidity,
        holderConcentration,
        creatorHoldings,
        sellPressure,
        volumeAnomaly,
        contractRisk,
      },
      weights: {
        liquidity: 20,
        holderConcentration: 20,
        creatorHoldings: 15,
        sellPressure: 20,
        volumeAnomaly: 10,
        contractRisk: 15,
      },
      source: 'risk-engine',
      generatedAt: new Date().toISOString(),
    };
  }

  /** Compact JSON for the LLM — numbers only, no narrative. */
  toAiJson(report: TokenRiskReport) {
    return {
      riskScore: report.riskScore,
      liquidityScore: report.liquidityScore,
      holderScore: report.holderScore,
      creatorScore: report.creatorScore,
      sellPressure: report.sellPressure,
      volumeAnomaly: report.volumeAnomaly,
      contractRisk: report.contractRisk,
    };
  }

  private liquidityScore(marketCap: number, volume24h: number, volMcap: number) {
    const mcap =
      marketCap >= 10e9 ? 88 : marketCap >= 1e9 ? 74 : marketCap >= 100e6 ? 58 : marketCap >= 20e6 ? 40 : 22;
    const volAbs = volume24h >= 1e9 ? 10 : volume24h >= 100e6 ? 7 : volume24h >= 20e6 ? 4 : 0;
    const turnover = volMcap >= 0.05 ? 6 : volMcap >= 0.02 ? 3 : 0;
    return round0(clamp(mcap + volAbs + turnover));
  }

  private proxyConcentration(marketCap: number) {
    if (marketCap >= 10e9) return 18;
    if (marketCap >= 1e9) return 28;
    if (marketCap >= 80e6) return 42;
    return 58;
  }

  private proxyCreator(marketCap: number, cats: string[]) {
    const meme = cats.some((c) => c.includes('meme') || c.includes('dog') || c.includes('frog'));
    if (marketCap >= 5e9) return 2;
    if (marketCap >= 1e9) return meme ? 8 : 4;
    if (marketCap >= 80e6) return meme ? 14 : 7;
    return meme ? 22 : 12;
  }

  private async sellPressureScore(symbol: string, c24: number, c7: number, volMcap: number) {
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const trades = await this.prisma.walletTrade.findMany({
      where: { symbol: symbol.toUpperCase(), createdAt: { gte: since } },
      select: { side: true, notionalUsd: true },
    });
    const buyUsd = trades.filter((t) => t.side === 'buy').reduce((s, t) => s + (t.notionalUsd || 0), 0);
    const sellUsd = trades.filter((t) => t.side === 'sell').reduce((s, t) => s + (t.notionalUsd || 0), 0);
    const flow = buyUsd + sellUsd;
    const sellShare = flow > 0 ? sellUsd / flow : 0.5;

    let score = 40;
    score += (sellShare - 0.5) * 70;
    if (c24 < 0) score += Math.min(25, Math.abs(c24) * 1.4);
    if (c7 < 0) score += Math.min(12, Math.abs(c7) * 0.35);
    if (c24 < -4 && volMcap > 0.08) score += 8;
    return round0(clamp(score));
  }

  private volumeAnomalyScore(volMcap: number, c24: number) {
    // Healthy turnover ~2–12%. Extreme high (pump) or dead thin = anomaly.
    if (volMcap <= 0) return 45;
    if (volMcap > 0.45) return round0(clamp(70 + Math.min(25, (volMcap - 0.45) * 40) + (Math.abs(c24) > 15 ? 8 : 0)));
    if (volMcap > 0.2) return round0(clamp(45 + (volMcap - 0.2) * 80));
    if (volMcap < 0.008) return 62;
    if (volMcap < 0.02) return 38;
    return round0(clamp(12 + Math.abs(volMcap - 0.06) * 80));
  }

  private contractRiskScore(
    marketCap: number,
    cats: string[],
    creatorHoldings: number,
    holderConcentration: number,
  ) {
    const meme = cats.some((c) => c.includes('meme'));
    const newish = cats.some((c) => c.includes('new') || c.includes('launch'));
    let score = marketCap >= 10e9 ? 6 : marketCap >= 1e9 ? 10 : marketCap >= 100e6 ? 18 : marketCap >= 20e6 ? 32 : 48;
    if (meme) score += 14;
    if (newish) score += 10;
    score += creatorHoldings * 0.35;
    score += Math.max(0, holderConcentration - 40) * 0.25;
    return round0(clamp(score));
  }
}
