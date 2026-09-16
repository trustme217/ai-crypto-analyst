export type StrategyOp = {
  gte?: number;
  gt?: number;
  lte?: number;
  lt?: number;
  eq?: number;
};

export type StrategyConditions = Record<string, StrategyOp>;

export type StrategyDefinition = {
  name: string;
  conditions: StrategyConditions;
};

export type StrategyFacts = {
  coingeckoId: string;
  symbol: string;
  name: string;
  price: number;
  tokenScore: number;
  smartMoneyScore: number;
  liquidityScore: number;
  /** USD liquidity proxy (24h volume) — screenshot uses gte: 300000 */
  liquidity: number;
  volume24h: number;
  marketCap: number;
  momentum: number;
  holderQuality: number;
  riskScore: number;
  sellPressure?: number;
};

export function matchConditions(
  facts: StrategyFacts,
  conditions: StrategyConditions,
): { ok: boolean; failed: string[] } {
  const failed: string[] = [];
  const bag = facts as unknown as Record<string, number | undefined>;
  for (const [key, op] of Object.entries(conditions || {})) {
    const actual = bag[key];
    if (actual == null || !Number.isFinite(actual)) {
      failed.push(`${key} missing`);
      continue;
    }
    if (op.gte != null && !(actual >= op.gte)) failed.push(`${key} ${actual} < ${op.gte}`);
    if (op.gt != null && !(actual > op.gt)) failed.push(`${key} ${actual} <= ${op.gt}`);
    if (op.lte != null && !(actual <= op.lte)) failed.push(`${key} ${actual} > ${op.lte}`);
    if (op.lt != null && !(actual < op.lt)) failed.push(`${key} ${actual} >= ${op.lt}`);
    if (op.eq != null && actual !== op.eq) failed.push(`${key} ${actual} != ${op.eq}`);
  }
  return { ok: failed.length === 0, failed };
}

export const DEFAULT_STRATEGIES: Array<{
  name: string;
  slug: string;
  side: 'long' | 'short';
  maxRiskScore: number;
  notionalUsd: number;
  conditions: StrategyConditions;
}> = [
  {
    name: 'Smart Money Accumulation',
    slug: 'smart-money-accumulation',
    side: 'long',
    maxRiskScore: 70,
    notionalUsd: 250,
    conditions: {
      smartMoneyScore: { gte: 85 },
      tokenScore: { gte: 80 },
      liquidity: { gte: 300000 },
    },
  },
];
