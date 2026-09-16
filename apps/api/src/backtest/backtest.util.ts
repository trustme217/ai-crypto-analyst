export const BACKTEST_HORIZONS = [
  { key: '5m' as const, ms: 5 * 60_000, ret: 'ret5m' as const, price: 'price5m' as const, slackMs: 3 * 60_000 },
  { key: '15m' as const, ms: 15 * 60_000, ret: 'ret15m' as const, price: 'price15m' as const, slackMs: 6 * 60_000 },
  { key: '1h' as const, ms: 60 * 60_000, ret: 'ret1h' as const, price: 'price1h' as const, slackMs: 15 * 60_000 },
  { key: '6h' as const, ms: 6 * 60 * 60_000, ret: 'ret6h' as const, price: 'price6h' as const, slackMs: 45 * 60_000 },
  { key: '24h' as const, ms: 24 * 60 * 60_000, ret: 'ret24h' as const, price: 'price24h' as const, slackMs: 90 * 60_000 },
];

export type HorizonKey = (typeof BACKTEST_HORIZONS)[number]['key'];

export function scoreBucket(score: number): { min: number; max: number; label: string } {
  const min = Math.min(90, Math.floor(score / 10) * 10);
  return { min, max: min + 10, label: `${min}-${min + 10}` };
}

export function pctReturn(signalPrice: number, later: number): number | null {
  if (!(signalPrice > 0) || !(later > 0)) return null;
  return Math.round(((later - signalPrice) / signalPrice) * 1000) / 10;
}
