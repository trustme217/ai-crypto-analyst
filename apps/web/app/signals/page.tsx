'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, formatPct, formatUsd, isLoggedIn, type TradingSignal } from '@/lib/api';

export default function SignalsPage() {
  const [style, setStyle] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [source, setSource] = useState<string>('');
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
        setSource(r.source || 'heuristic');
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [style]);

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Heuristic momentum signals</div>
        <h1>24h change rankings.</h1>
      </header>

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

      {source && (
        <p className="muted">
          Source: <strong>{source}</strong> rules on live CoinGecko prices — not LLM output.
        </p>
      )}
      {disclaimer && <p className="muted">{disclaimer}</p>}
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Ranking momentum…</p>}

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Side</th>
              <th>Conf.</th>
              <th>Entry</th>
              <th>SL / TP</th>
              <th>24h</th>
              <th>Why</th>
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
                <td>
                  <span
                    className={`pill ${
                      s.side === 'long' ? 'bullish' : s.side === 'short' ? 'bearish' : 'neutral'
                    }`}
                  >
                    {s.side}
                  </span>
                </td>
                <td>{s.confidence}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                  {formatUsd(s.entry, 4)}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                  {formatUsd(s.stopLoss, 4)} / {formatUsd(s.takeProfit, 4)}
                </td>
                <td className={s.change24h >= 0 ? 'up' : 'down'}>{formatPct(s.change24h)}</td>
                <td className="muted" style={{ fontSize: '0.8rem', maxWidth: 220 }}>
                  {s.rationale}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
