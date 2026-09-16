'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, formatPct, formatUsd } from '@/lib/api';

type Summary = Awaited<ReturnType<typeof api.backtest>>;
const HORIZONS = ['5m', '15m', '1h', '6h', '24h'] as const;

export default function BacktestPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filling, setFilling] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setData(await api.backtest());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onFill() {
    setFilling(true);
    try {
      await api.fillBacktest();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFilling(false);
    }
  }

  const example = data?.recent[0];

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Backtest</div>
        <h1>Does Token Score predict?</h1>
      </header>
      <p className="muted" style={{ marginTop: '0.5rem' }}>
        Each scored signal records the live price, then fills 5m / 15m / 1h / 6h / 24h returns from sampled
        prices. Buckets show whether high scores actually led. Paper only — not advice.{' '}
        <Link href="/signals">Token Score</Link>
      </p>

      <div className="cta-row" style={{ marginTop: '0.85rem' }}>
        <button className="btn" type="button" onClick={onFill} disabled={filling}>
          {filling ? 'Filling horizons…' : 'Fill due horizons'}
        </button>
        <span className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
          {data ? `${data.totalSignals} / ${data.target} signals` : '—'}
        </span>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && !data && <p className="muted">Loading backtest…</p>}

      {example && (
        <div className="grid-2" style={{ marginTop: '1.1rem' }}>
          <div className="panel">
            <h3 className="panel-title">Latest observation</h3>
            <p>
              <Link href={`/token/${example.coingeckoId}`}>
                <strong>{example.symbol}</strong>
              </Link>{' '}
              / {example.name}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)' }}>Score = {example.score}</p>
            <p className="muted">signal price = {formatUsd(example.signalPrice, 6)}</p>
          </div>
          <div className="panel">
            <h3 className="panel-title">Forward returns</h3>
            <table className="table">
              <tbody>
                {HORIZONS.map((h) => (
                  <tr key={h}>
                    <td>{h}</td>
                    <td
                      className={
                        example.returns[h] == null ? '' : example.returns[h]! >= 0 ? 'up' : 'down'
                      }
                      style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}
                    >
                      {example.returns[h] == null ? 'pending' : formatPct(example.returns[h])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginTop: '1.1rem' }}>
        <h3 className="panel-title">Score buckets (averages)</h3>
        {!data?.buckets.length && <p className="muted">No scored signals recorded yet.</p>}
        {!!data?.buckets.length && (
          <table className="table">
            <thead>
              <tr>
                <th>Score</th>
                <th>n</th>
                {HORIZONS.map((h) => (
                  <th key={h}>{h} average</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.buckets.map((b) => (
                <tr key={b.range}>
                  <td>
                    <strong>{b.range}</strong>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{b.count}</td>
                  {HORIZONS.map((h) => (
                    <td
                      key={h}
                      className={b.avg[h] == null ? '' : b.avg[h]! >= 0 ? 'up' : 'down'}
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {b.avg[h] == null ? '—' : formatPct(b.avg[h])}
                      <div className="muted" style={{ fontSize: '0.7rem' }}>
                        {b.filled[h]}/{b.count}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ marginTop: '1.1rem' }}>
        <h3 className="panel-title">Recent scored signals</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Score</th>
              <th>Price</th>
              {HORIZONS.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.recent || []).map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/token/${s.coingeckoId}`}>
                    <strong>{s.symbol}</strong>
                  </Link>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{s.score}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{formatUsd(s.signalPrice, 6)}</td>
                {HORIZONS.map((h) => (
                  <td
                    key={h}
                    className={s.returns[h] == null ? '' : s.returns[h]! >= 0 ? 'up' : 'down'}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {s.returns[h] == null ? '—' : formatPct(s.returns[h])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data?.disclaimer && (
        <p className="muted" style={{ marginTop: '0.85rem' }}>
          {data.disclaimer}
        </p>
      )}
    </main>
  );
}
