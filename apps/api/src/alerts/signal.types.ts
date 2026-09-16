export const SIGNAL_TYPES = [
  'SMART_MONEY_BUY',
  'TOKEN_SCORE_CHANGE',
  'WHALE_ACTIVITY',
  'LIQUIDITY_DROP',
  'RISK_CHANGE',
  'AI_SIGNAL',
  'PRICE',
  'VOLUME',
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

export type SignalWalletLine = {
  label: string;
  pnl: number;
};

export type SignalPayload = {
  smartMoneyScore?: number;
  wallets?: SignalWalletLine[];
  walletCount?: number;
  combinedUsd?: number;
  liquidityScore?: number;
  volume24h?: number;
  marketCap?: number;
  riskScore?: number;
  aiSummary?: string;
  tokenScore?: number;
  prevTokenScore?: number;
  price?: number;
  prevPrice?: number;
  changePct?: number;
  direction?: string;
  targetPrice?: number;
  whaleOwnership?: number;
  prevWhale?: number;
  prevVolume?: number;
  prevRisk?: number;
  prevLiquidity?: number;
};

export type SignalDraft = {
  type: SignalType;
  coingeckoId: string;
  symbol: string;
  name: string;
  fingerprint: string;
  payload: SignalPayload;
};
