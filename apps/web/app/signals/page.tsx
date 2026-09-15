'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, formatPct, formatUsd, isLoggedIn, type TradingSignal } from '@/lib/api';

export default function SignalsPage() {
  const [style, setStyle] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [source, setSource] = useState<string>('');
  const [weights, setWeights] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) return;
    api
      .settings()
      .then((s) => {
        if (s.signalStyle) setStyle(s.signalStyle);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .signals(style)
      .then((r) => {
        setSignals(r.signals);
        setDisclaimer(r.disclaimer);
        setSource(r.source || 'token-score');
        setWeights(r.weights || null);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [style]);

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Token Score engine</div>
        <h1>Deterministic rankings.</h1>
      </header>

      <p className="muted">
        Scores are calculated from rules (not LLM). See{' '}
        <Link href="/smart-money">Smart money</Link> for wallet-driven SM component.
      </p>

      <div className="cta-row">
        {(['conservative', 'balanced', 'aggressive'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`chip ${style === s ? 'active' : ''}`}
            onClick={() => setStyle(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {weights && (
        <p className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
          Weights — SM {weights.smartMoney}% · Liq {weights.liquidity}% · Vol {weights.volume}% · Mom{' '}
          {weights.momentum}% · Hold {weights.holderQuality}% · Risk {weights.risk}%
        </p>
      )}
      {source && (
        <p className="muted">
          Source: <strong>{source}</strong> — numbers are deterministic; AI only explains later.
        </p>
      )}
      {disclaimer && <p className="muted">{disclaimer}</p>}
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Scoring tokens…</p>}

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Score</th>
              <th>SM</th>
              <th>Liq</th>
              <th>Vol</th>
              <th>Mom</th>
              <th>Hold</th>
              <th>Risk</th>
              <th>Side</th>
              <th>24h</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/token/${s.coingeckoId}`} className="coin-cell">
                    <img src={s.image} alt="" />
                    <span>
                      <strong>{s.symbol}</strong>
                      <div className="muted">{s.name}</div>
                    </span>
                  </Link>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {s.scores?.score ?? s.confidence}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                  {s.scores?.smartMoney ?? '—'}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                  {s.scores?.liquidity ?? '—'}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                  {s.scores?.volume ?? '—'}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                  {s.scores?.momentum ?? '—'}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                  {s.scores?.holderQuality ?? '—'}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                  {s.scores?.risk ?? '—'}
                </td>
                <td>
                  <span
                    className={`pill ${
                      s.side === 'long' ? 'bullish' : s.side === 'short' ? 'bearish' : 'neutral'
                    }`}
                  >
                    {s.side}
                  </span>
                </td>
                <td className={s.change24h >= 0 ? 'up' : 'down'}>{formatPct(s.change24h)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && signals[0] && (
        <div className="panel">
          <h3 className="panel-title">Top idea detail</h3>
          <p className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
            {JSON.stringify(
              {
                token: signals[0].scores?.token,
                score: signals[0].scores?.score,
                smartMoney: signals[0].scores?.smartMoney,
                liquidity: signals[0].scores?.liquidity,
                volume: signals[0].scores?.volume,
                momentum: signals[0].scores?.momentum,
                holderQuality: signals[0].scores?.holderQuality,
                risk: signals[0].scores?.risk,
              },
              null,
              2,
            )}
          </p>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Entry {formatUsd(signals[0].entry, 4)} · SL {formatUsd(signals[0].stopLoss, 4)} · TP{' '}
            {formatUsd(signals[0].takeProfit, 4)}
          </p>
        </div>
      )}
    </main>
  );
}
