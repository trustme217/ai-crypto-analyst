'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { api, formatPct, formatUsd, isLoggedIn } from '@/lib/api';

type Portfolio = Awaited<ReturnType<typeof api.portfolio>>;

export default function PortfolioPage() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coingeckoId, setCoingeckoId] = useState('solana');
  const [quantity, setQuantity] = useState('10');
  const [avgCost, setAvgCost] = useState('100');
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!isLoggedIn()) {
      setError('Sign in on Account to track a paper portfolio.');
      setData(null);
      return;
    }
    try {
      setData(await api.portfolio());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.addPosition(coingeckoId.trim(), Number(quantity), Number(avgCost));
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Portfolio</div>
        <h1>Paper positions & PnL.</h1>
      </header>

      {error && (
        <p className="error">
          {error} {!isLoggedIn() && <Link href="/auth">Go to Account →</Link>}
        </p>
      )}

      {data && (
        <div className="stats" style={{ margin: '1rem 0', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat">
            <div className="label">Value</div>
            <div className="value">{formatUsd(data.summary.marketValue)}</div>
          </div>
          <div className="stat">
            <div className="label">Cost</div>
            <div className="value">{formatUsd(data.summary.cost)}</div>
          </div>
          <div className="stat">
            <div className="label">PnL</div>
            <div className={`value ${data.summary.pnl >= 0 ? 'up' : 'down'}`}>
              {formatUsd(data.summary.pnl)}
            </div>
          </div>
          <div className="stat">
            <div className="label">PnL %</div>
            <div className={`value ${data.summary.pnlPct >= 0 ? 'up' : 'down'}`}>
              {formatPct(data.summary.pnlPct)}
            </div>
          </div>
        </div>
      )}

      <div className="grid-2">
        <form className="panel" onSubmit={onAdd}>
          <h3 className="panel-title">Add position</h3>
          <div className="field">
            <label htmlFor="pid">CoinGecko ID</label>
            <input id="pid" value={coingeckoId} onChange={(e) => setCoingeckoId(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="qty">Quantity</label>
            <input id="qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cost">Avg cost (USD)</label>
            <input id="cost" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} />
          </div>
          <button className="btn" disabled={saving || !isLoggedIn()}>
            {saving ? 'Saving…' : 'Save position'}
          </button>
        </form>

        <div className="panel">
          <h3 className="panel-title">Holdings</h3>
          {!data?.positions.length && <p className="muted">No positions yet.</p>}
          <table className="table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Qty</th>
                <th>Value</th>
                <th>PnL</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data?.positions.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/token/${p.coingeckoId}`}>
                      <strong>{p.symbol}</strong>
                    </Link>
                  </td>
                  <td>{p.quantity}</td>
                  <td>{p.marketValue != null ? formatUsd(p.marketValue) : '—'}</td>
                  <td className={(p.pnl ?? 0) >= 0 ? 'up' : 'down'}>
                    {p.pnlPct != null ? formatPct(p.pnlPct) : '—'}
                  </td>
                  <td>
                    <button className="btn secondary" onClick={() => api.removePosition(p.id).then(load)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
