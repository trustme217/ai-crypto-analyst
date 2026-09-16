import { SIGNAL_TYPES, type SignalPayload, type SignalType } from './signal.types';

export { SIGNAL_TYPES };

export function compactUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 100_000) return `$${(abs / 1_000).toFixed(0)}K`;
  return `$${Math.round(abs).toLocaleString('en-US')}`;
}

export function signedUsd(n: number): string {
  return `${n >= 0 ? '+' : '-'}${compactUsd(n)}`;
}

export function riskLabel(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 67) return 'High';
  if (score >= 34) return 'Medium';
  return 'Low';
}

export function signalTitle(type: SignalType): string {
  switch (type) {
    case 'SMART_MONEY_BUY':
      return 'SMART MONEY ACTIVITY';
    case 'TOKEN_SCORE_CHANGE':
      return 'TOKEN SCORE CHANGE';
    case 'WHALE_ACTIVITY':
      return 'WHALE ACTIVITY';
    case 'LIQUIDITY_DROP':
      return 'LIQUIDITY DROP';
    case 'RISK_CHANGE':
      return 'RISK CHANGE';
    case 'AI_SIGNAL':
      return 'AI SIGNAL';
    case 'PRICE':
      return 'PRICE';
    case 'VOLUME':
      return 'VOLUME';
  }
}

export function formatSignalMessage(
  type: SignalType,
  symbol: string,
  name: string,
  payload: SignalPayload,
): string {
  const title = signalTitle(type);
  const header = type === 'SMART_MONEY_BUY' ? `🚨 ${title}` : title;
  const lines = [header, `$${symbol.toUpperCase()} / ${name}`, ''];

  if (type === 'SMART_MONEY_BUY') {
    if (payload.smartMoneyScore != null) lines.push(`Smart Money Score: ${payload.smartMoneyScore}`);
    if (payload.walletCount != null) {
      lines.push(
        `${payload.walletCount} tracked wallet${payload.walletCount === 1 ? '' : 's'} bought`,
      );
    }
    if (payload.combinedUsd != null) lines.push(`${compactUsd(payload.combinedUsd)} combined`);
    if (payload.wallets?.length) {
      lines.push('', 'Wallets:');
      for (const w of payload.wallets.slice(0, 5)) {
        lines.push(`• ${w.label} ${signedUsd(w.pnl)} historical PnL`);
      }
    }
  } else if (type === 'TOKEN_SCORE_CHANGE') {
    lines.push(`Token Score: ${payload.prevTokenScore} → ${payload.tokenScore}`);
  } else if (type === 'WHALE_ACTIVITY') {
    lines.push(`Whale ownership: ${payload.prevWhale}% → ${payload.whaleOwnership}%`);
  } else if (type === 'LIQUIDITY_DROP') {
    lines.push(`Liquidity score: ${payload.prevLiquidity} → ${payload.liquidityScore}`);
  } else if (type === 'RISK_CHANGE') {
    lines.push(`Risk Score: ${payload.prevRisk} → ${payload.riskScore}`);
  } else if (type === 'AI_SIGNAL') {
    if (payload.tokenScore != null) lines.push(`Research score: ${payload.tokenScore}/100`);
  } else if (type === 'PRICE') {
    if (payload.direction && payload.targetPrice != null) {
      lines.push(`Price is ${payload.direction} $${payload.targetPrice}`);
    }
    if (payload.price != null) lines.push(`Current: $${payload.price}`);
    if (payload.changePct != null) {
      lines.push(`Move vs last snapshot: ${payload.changePct >= 0 ? '+' : ''}${payload.changePct.toFixed(2)}%`);
    }
  } else if (type === 'VOLUME') {
    if (payload.prevVolume != null && payload.volume24h != null) {
      lines.push(`24h volume: ${compactUsd(payload.prevVolume)} → ${compactUsd(payload.volume24h)}`);
    }
  }

  if (payload.liquidityScore != null && type === 'SMART_MONEY_BUY') {
    lines.push('', `Liquidity score: ${payload.liquidityScore}/100`);
  }
  if (payload.volume24h != null && type !== 'VOLUME') {
    lines.push(`24h Volume: ${compactUsd(payload.volume24h)}`);
  }
  if (payload.riskScore != null) {
    lines.push(`Risk: ${riskLabel(payload.riskScore)}`);
  }
  if (payload.aiSummary) {
    lines.push('', 'AI Analysis:', payload.aiSummary);
  }

  return lines.join('\n').trim();
}
