export const QUEUE = {
  blockchain: 'blockchain',
  scoring: 'scoring',
  ai: 'ai',
  alerts: 'alerts',
} as const;

export const PIPELINE = [
  'Solana',
  'Blockchain Queue',
  'Parser',
  'PostgreSQL',
  'Scoring Queue',
  'Scoring',
  'AI Queue',
  'AI',
  'Alert Queue',
  'Telegram',
] as const;
