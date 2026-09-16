'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, formatUsd } from '@/lib/api';

type Desk = Awaited<ReturnType<typeof api.strategies>>;

export default function StrategiesPage() {
  const [desk, setDesk] = useState<Desk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function load() {
    try {
      setDesk(await api.strategies());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onRun() {
    setRunning(true);
    try {
      await api.runStrategies();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Strategy</div>
        <h1>JSON rules → paper fills.</h1>
      </header>
      <p className="muted" style={{ marginTop: '0.5rem' }}>
        {(desk?.flow || ['Signal', 'Strategy', 'Risk Engine', 'Paper Trade']).join(' → ')}. Conditions are
        deterministic. Risk Engine must clear before a paper trade. Not live.{' '}
        <Link href="/signals">Signals</Link> · <Link href="/backtest">Backtest</Link>
      </p>

      <div className="cta-row" style={{ marginTop: '0.85rem' }}>
        <button className="btn" type="button" onClick={onRun} disabled={running}>
          {running ? 'Evaluating…' : 'Run strategies'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="grid-2" style={{ marginTop: '1.1rem' }}>
        {(desk?.strategies || []).map((s) => (
          <div className="panel" key={s.id}>
            <h3 className="panel-title">{s.name}</h3>
            <p className="muted">
              {s.side} · max risk {s.maxRiskScore} · paper {formatUsd(s.notionalUsd)}
            </p>
            <pre
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem 0.9rem',
                borderRadius: 12,
                background: 'var(--panel-2)',
                fontSize: '0.8rem',
                overflowX: 'auto',
              }}
            >
              {JSON.stringify(s.definition, null, 2)}
            </pre>
          </div>
        ))}
        {!desk?.strategies.length && (
          <div className="panel">
            <p className="muted">No strategies seeded yet.</p>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: '1.1rem' }}>
        <h3 className="panel-title">Paper trades</h3>
        {!desk?.fills.length && <p className="muted">No strategy fills yet. Run strategies after scores land.</p>}
        <table className="table">
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Asset</th>
              <th>Side</th>
              <th>Notional</th>
              <th>Token</th>
              <th>SM</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {(desk?.fills || []).map((f) => (
              <tr key={f.id}>
                <td>{f.strategyName}</td>
                <td>
                  <Link href={`/token/${f.coingeckoId}`}>
                    <strong>{f.symbol}</strong>
                  </Link>
                </td>
                <td>
                  <span className={`pill ${f.side === 'buy' ? 'bullish' : 'bearish'}`}>{f.side}</span>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{formatUsd(f.notionalUsd)}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{f.tokenScore}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{f.smartMoneyScore}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{f.riskScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
