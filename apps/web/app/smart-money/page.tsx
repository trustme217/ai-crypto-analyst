'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Wallet = Awaited<ReturnType<typeof api.smartMoneyWallets>>['wallets'][number];
type SmSignal = Awaited<ReturnType<typeof api.smartMoneySignals>>['signals'][number];
type SmEvent = Awaited<ReturnType<typeof api.smartMoneyEvents>>['events'][number];

export default function SmartMoneyPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [signals, setSignals] = useState<SmSignal[]>([]);
  const [events, setEvents] = useState<SmEvent[]>([]);
  const [pipeline, setPipeline] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      api.smartMoneyWallets(),
      api.smartMoneySignals(30),
      api.smartMoneyEvents(30),
    ])
      .then(([w, s, e]) => {
        setWallets(w.wallets);
        setSignals(s.signals);
        setEvents(e.events);
        setPipeline(e.pipeline);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  async function runIngest() {
    setIngesting(true);
    try {
      await api.smartMoneyIngest();
      await new Promise((r) => setTimeout(r, 2500));
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIngesting(false);
    }
  }

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Smart money</div>
        <h1>Which wallets are buying now?</h1>
      </header>
      <p className="muted">
        BullMQ pipeline: Solana → blockchain queue → parser → PostgreSQL → scoring → AI → alerts →
        Telegram. Feeds Token Score SM weight (30%).
      </p>
      {pipeline.length > 0 && (
        <p className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
          {pipeline.join(' → ')}
        </p>
      )}
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn" onClick={() => void runIngest()} disabled={ingesting}>
          {ingesting ? 'Ingesting…' : 'Run ingest now'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="panel">
        <h3 className="panel-title">SMART MONEY SIGNAL</h3>
        {!signals.length && (
          <p className="muted">Waiting for clustered buys from ingest…</p>
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
        <h3 className="panel-title">Normalized events</h3>
        {!events.length && <p className="muted">No events yet — run ingest.</p>}
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Token</th>
              <th>Amount</th>
              <th>Wallet</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={`${e.signature}-${e.token}-${e.type}`}>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{e.type}</td>
                <td>{e.tokenSymbol || e.token.slice(0, 8)}</td>
                <td>{e.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                <td>{e.label || e.wallet.slice(0, 8)}</td>
                <td className="muted" style={{ fontSize: '0.8rem' }}>
                  {new Date(e.timestamp).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3 className="panel-title">Tracked wallets</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Source</th>
              <th>Win rate</th>
              <th>PnL</th>
              <th>SM score</th>
              <th>Best</th>
              <th>Last ingest</th>
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
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{w.source}</td>
                <td>{w.winRate}%</td>
                <td className={w.totalPnL >= 0 ? 'up' : 'down'}>
                  ${w.totalPnL >= 0 ? '+' : ''}
                  {(w.totalPnL / 1000).toFixed(0)}K
                </td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{w.smartMoneyScore}</td>
                <td>{w.bestToken || '—'}</td>
                <td className="muted" style={{ fontSize: '0.75rem' }}>
                  {w.lastIngestAt ? new Date(w.lastIngestAt).toLocaleTimeString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
