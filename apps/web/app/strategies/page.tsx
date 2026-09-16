'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, formatPct, formatUsd } from '@/lib/api';

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

  const flow = desk?.flow || [
    'Smart Money Signal',
    'Token Score',
    'AI Analysis',
    'Strategy',
    'Risk Engine',
    'Paper Trade',
    'Position',
    'PnL',
  ];

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Strategy</div>
        <h1>Signal → paper book → PnL.</h1>
      </header>
      <p className="muted" style={{ marginTop: '0.5rem' }}>
        {flow.join(' → ')}. Compare AI-only vs Momentum vs Smart-money vs Smart-money + AI without real
        money. <Link href="/signals">Signals</Link> · <Link href="/portfolio">Portfolio</Link>
      </p>

      <div className="cta-row" style={{ marginTop: '0.85rem' }}>
        <button className="btn" type="button" onClick={onRun} disabled={running}>
          {running ? 'Evaluating…' : 'Run pipeline'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="panel" style={{ marginTop: '1.1rem' }}>
        <h3 className="panel-title">Strategy comparison (paper)</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Book</th>
              <th>Fills</th>
              <th>Cost</th>
              <th>Value</th>
              <th>PnL</th>
            </tr>
          </thead>
          <tbody>
            {(desk?.books || []).map((b) => (
              <tr key={b.id}>
                <td>
                  <strong>{b.name}</strong>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{b.fills}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{formatUsd(b.cost)}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{formatUsd(b.value)}</td>
                <td className={b.pnl >= 0 ? 'up' : 'down'} style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatUsd(b.pnl)} ({formatPct(b.pnlPct)})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
      </div>

      <div className="panel" style={{ marginTop: '1.1rem' }}>
        <h3 className="panel-title">Positions</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Book</th>
              <th>Asset</th>
              <th>Qty</th>
              <th>Value</th>
              <th>PnL</th>
            </tr>
          </thead>
          <tbody>
            {(desk?.books || []).flatMap((b) =>
              b.positions.map((p) => (
                <tr key={`${b.id}-${p.coingeckoId}`}>
                  <td>{b.name}</td>
                  <td>
                    <Link href={`/token/${p.coingeckoId}`}>
                      <strong>{p.symbol}</strong>
                    </Link>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{p.quantity.toFixed(4)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{formatUsd(p.marketValue)}</td>
                  <td className={p.pnl >= 0 ? 'up' : 'down'}>{formatPct(p.pnlPct)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: '1.1rem' }}>
        <h3 className="panel-title">Paper trades</h3>
        {!desk?.fills.length && <p className="muted">No strategy fills yet. Run the pipeline after scores land.</p>}
        <table className="table">
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Asset</th>
              <th>Side</th>
              <th>Notional</th>
              <th>Token</th>
              <th>SM</th>
              <th>AI</th>
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
                <td style={{ fontFamily: 'var(--font-mono)' }}>{f.aiScore ?? '—'}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{f.riskScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
