'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Wallet = Awaited<ReturnType<typeof api.smartMoneyWallets>>['wallets'][number];
type SmSignal = Awaited<ReturnType<typeof api.smartMoneySignals>>['signals'][number];

export default function SmartMoneyPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [signals, setSignals] = useState<SmSignal[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.smartMoneyWallets(), api.smartMoneySignals(30)])
      .then(([w, s]) => {
        setWallets(w.wallets);
        setSignals(s.signals);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Smart money</div>
        <h1>Which wallets are buying now?</h1>
      </header>
      <p className="muted">
        Tracked high-performing wallets feed the Token Score smart-money weight (30%). Demo ingest runs
        in the background — research only.
      </p>
      {error && <p className="error">{error}</p>}

      <div className="panel">
        <h3 className="panel-title">SMART MONEY SIGNAL</h3>
        {!signals.length && (
          <p className="muted">Waiting for clustered buys (stub ingest every ~2 minutes)…</p>
        )}
        {signals.map((s) => (
          <div
            key={s.symbol}
            style={{
              marginBottom: '1rem',
              padding: '0.85rem 1rem',
              border: '1px solid var(--line)',
              borderRadius: 14,
              background: 'var(--panel-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.88rem',
            }}
          >
            <div style={{ marginBottom: '0.35rem' }}>
              {s.coingeckoId ? (
                <Link href={`/token/${s.coingeckoId}`}>
                  <strong>{s.symbol}</strong>
                </Link>
              ) : (
                <strong>{s.symbol}</strong>
              )}{' '}
              · Score {s.score}/100
            </div>
            <div className="muted">{s.summary}</div>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
              {s.wallets.map((w) => (
                <li key={w.address}>
                  {w.label || w.address.slice(0, 8)} — win {w.winRate}% · PnL $
                  {(w.totalPnL / 1000).toFixed(0)}K · {w.side}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3 className="panel-title">Tracked wallets</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Win rate</th>
              <th>PnL</th>
              <th>SM score</th>
              <th>Best</th>
              <th>Trades</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((w) => (
              <tr key={w.id}>
                <td>
                  <strong>{w.label || 'Wallet'}</strong>
                  <div className="muted" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                    {w.address.slice(0, 12)}…
                  </div>
                </td>
                <td>{w.winRate}%</td>
                <td className={w.totalPnL >= 0 ? 'up' : 'down'}>
                  ${w.totalPnL >= 0 ? '+' : ''}
                  {(w.totalPnL / 1000).toFixed(0)}K
                </td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{w.smartMoneyScore}</td>
                <td>{w.bestToken || '—'}</td>
                <td>{w.totalTrades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
