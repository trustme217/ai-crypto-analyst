/** Deterministic Solana tx → normalized trade events (no LLM). */

export type NormalizedChainEvent = {
  chain: 'SOLANA';
  signature: string;
  wallet: string;
  token: string;
  tokenSymbol: string | null;
  type: 'BUY' | 'SELL' | 'TRANSFER';
  amount: number;
  valueUsd: number | null;
  timestamp: string;
};

type TokenBal = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount?: { uiAmount: number | null; decimals: number; amount: string };
};

type ParsedTx = {
  blockTime?: number | null;
  meta?: {
    err: unknown;
    preBalances?: number[];
    postBalances?: number[];
    preTokenBalances?: TokenBal[];
    postTokenBalances?: TokenBal[];
  } | null;
  transaction?: {
    message?: {
      accountKeys?: Array<string | { pubkey: string }>;
    };
  };
};

const WSOL = 'So11111111111111111111111111111111111111112';
const KNOWN: Record<string, { symbol: string; usdApprox: number | null }> = {
  [WSOL]: { symbol: 'SOL', usdApprox: null },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', usdApprox: 1 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', usdApprox: 1 },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: { symbol: 'BONK', usdApprox: null },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: { symbol: 'JUP', usdApprox: null },
};

function keyPubkey(k: string | { pubkey: string }): string {
  return typeof k === 'string' ? k : k.pubkey;
}

function balMap(list: TokenBal[] | undefined, owner: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of list || []) {
    if (b.owner && b.owner !== owner) continue;
    const amt = b.uiTokenAmount?.uiAmount;
    if (amt == null) continue;
    m.set(b.mint, (m.get(b.mint) || 0) + amt);
  }
  return m;
}

/**
 * Infer BUY/SELL from token + SOL balance deltas for `wallet`.
 * BUY: token up & (SOL down or stablecoin down). SELL: inverse.
 */
export function parseWalletTransaction(
  signature: string,
  wallet: string,
  tx: ParsedTx | null | undefined,
): NormalizedChainEvent[] {
  if (!tx?.meta || tx.meta.err) return [];
  const keys = (tx.transaction?.message?.accountKeys || []).map(keyPubkey);
  const idx = keys.indexOf(wallet);
  const preTok = balMap(tx.meta.preTokenBalances, wallet);
  const postTok = balMap(tx.meta.postTokenBalances, wallet);
  const mints = new Set([...preTok.keys(), ...postTok.keys()]);

  let solDelta = 0;
  if (idx >= 0 && tx.meta.preBalances && tx.meta.postBalances) {
    solDelta = (tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / 1e9;
  }

  const ts =
    tx.blockTime != null
      ? new Date(tx.blockTime * 1000).toISOString()
      : new Date().toISOString();

  const events: NormalizedChainEvent[] = [];
  for (const mint of mints) {
    if (mint === WSOL) continue;
    const pre = preTok.get(mint) || 0;
    const post = postTok.get(mint) || 0;
    const delta = post - pre;
    if (Math.abs(delta) < 1e-9) continue;

    const known = KNOWN[mint];
    let type: NormalizedChainEvent['type'] = 'TRANSFER';
    if (delta > 0 && solDelta < -0.001) type = 'BUY';
    else if (delta < 0 && solDelta > 0.001) type = 'SELL';
    else if (delta > 0) type = 'BUY';
    else if (delta < 0) type = 'SELL';

    const amount = Math.abs(delta);
    const valueUsd =
      known?.usdApprox != null ? amount * known.usdApprox : null;

    events.push({
      chain: 'SOLANA',
      signature,
      wallet,
      token: mint,
      tokenSymbol: known?.symbol ?? null,
      type,
      amount,
      valueUsd,
      timestamp: ts,
    });
  }

  // Native SOL-only moves (no SPL delta) → skip as noise for smart-money token focus
  return events;
}
