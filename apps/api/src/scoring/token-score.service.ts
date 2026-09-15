import { Injectable } from '@nestjs/common';

/** Weights from AlphaMind plan — deterministic Token Score (not LLM). */
export const TOKEN_SCORE_WEIGHTS = {
  smartMoney: 0.3,
  liquidity: 0.15,
  volume: 0.15,
  momentum: 0.15,
  holderQuality: 0.15,
  risk: 0.1,
} as const;

export type TokenScoreBreakdown = {
  token: string;
  score: number;
  smartMoney: number;
  liquidity: number;
  volume: number;
  momentum: number;
  holderQuality: number;
  /** Higher = more risk (worse). Kept as risk score 0–100 for display. */
  risk: number;
};

export type TokenScoreInput = {
  symbol: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  change7d: number | null;
  marketCapRank: number | null;
  /** 0–100 from smart-money engine; null = use market proxy */
  smartMoneyScore?: number | null;
  /** Optional holder concentration proxy 0–100 */
  holderQualityScore?: number | null;
};

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

@Injectable()
export class TokenScoreService {
  /**
   * Deterministic token score. Numbers are calculated here; AI only explains later.
   */
  score(input: TokenScoreInput): TokenScoreBreakdown {
    const volMcap = input.marketCap > 0 ? input.volume24h / input.marketCap : 0;
    const c24 = input.change24h;
    const c7 = input.change7d ?? 0;

    // Momentum 0–100: blend 24h + 7d, centered at 50
    const momRaw = 50 + c24 * 2.2 + c7 * 0.45;
    const momentum = round1(clamp(momRaw));

    // Volume 0–100 from vol/mcap
    const volume = round1(
      clamp(volMcap <= 0 ? 20 : volMcap < 0.02 ? 35 + volMcap * 800 : volMcap < 0.08 ? 55 + volMcap * 400 : 75 + Math.min(25, volMcap * 100)),
    );

    // Liquidity 0–100 from market cap + volume absolute
    const mcapScore =
      input.marketCap >= 10e9 ? 92 : input.marketCap >= 1e9 ? 80 : input.marketCap >= 100e6 ? 65 : input.marketCap >= 20e6 ? 48 : 28;
    const volAbs =
      input.volume24h >= 1e9 ? 15 : input.volume24h >= 100e6 ? 10 : input.volume24h >= 20e6 ? 5 : 0;
    const liquidity = round1(clamp(mcapScore + volAbs));

    // Holder quality: rank proxy until on-chain holders land
    let holderQuality: number;
    if (input.holderQualityScore != null) {
      holderQuality = round1(clamp(input.holderQualityScore));
    } else if (input.marketCapRank != null && input.marketCapRank > 0) {
      holderQuality = round1(clamp(100 - Math.log10(input.marketCapRank + 1) * 28));
    } else {
      holderQuality = 50;
    }

    // Risk 0–100 (higher = riskier): volatility + thin liquidity
    const volRisk = Math.min(55, Math.abs(c24) * 3.5 + Math.abs(c7) * 0.8);
    const thinRisk = volMcap < 0.02 ? 25 : volMcap < 0.05 ? 12 : 0;
    const smallCapRisk = input.marketCap < 50e6 ? 20 : input.marketCap < 200e6 ? 10 : 0;
    const risk = round1(clamp(volRisk + thinRisk + smallCapRisk));

    // Smart money: real score when provided; else aligned momentum+volume proxy (neutral-ish)
    let smartMoney: number;
    if (input.smartMoneyScore != null) {
      smartMoney = round1(clamp(input.smartMoneyScore));
    } else {
      // Temporary proxy until wallet intelligence is warm
      smartMoney = round1(clamp(40 + (momentum - 50) * 0.35 + (volume - 50) * 0.25));
    }

    // Composite: risk is inverted (low risk = high contribution)
    const riskContribution = 100 - risk;
    const score = round1(
      clamp(
        smartMoney * TOKEN_SCORE_WEIGHTS.smartMoney +
          liquidity * TOKEN_SCORE_WEIGHTS.liquidity +
          volume * TOKEN_SCORE_WEIGHTS.volume +
          momentum * TOKEN_SCORE_WEIGHTS.momentum +
          holderQuality * TOKEN_SCORE_WEIGHTS.holderQuality +
          riskContribution * TOKEN_SCORE_WEIGHTS.risk,
      ),
    );

    return {
      token: input.symbol.toUpperCase(),
      score,
      smartMoney,
      liquidity,
      volume,
      momentum,
      holderQuality,
      risk,
    };
  }
}
