'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { api, formatUsd, isLoggedIn } from '@/lib/api';

type AlertRow = Awaited<ReturnType<typeof api.alerts>>['alerts'][number];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [telegramOk, setTelegramOk] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coingeckoId, setCoingeckoId] = useState('bitcoin');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [target, setTarget] = useState('80000');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const coin = new URLSearchParams(window.location.search).get('coin');
    if (coin) setCoingeckoId(coin);
  }, []);

  async function load() {
    if (!isLoggedIn()) {
      setError('Sign in on Account to create price alerts.');
      setAlerts([]);
      return;
    }
    try {
      const res = await api.alerts();
      setAlerts(res.alerts);
      setTelegramOk(res.telegram?.botConfigured ?? null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createAlert(coingeckoId.trim(), direction, Number(target));
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
        <div className="eyebrow">Alerts</div>
        <h1>Watch price levels.</h1>
      </header>

      <p className="muted" style={{ marginTop: '0.5rem' }}>
        When a level is hit, the API sends a Telegram message (if enabled in{' '}
        <Link href="/settings">Settings</Link>
        ). Status <strong>sent</strong> means the bot was notified.
        {telegramOk === false && ' TELEGRAM_BOT_TOKEN is not set on the API yet.'}
        {telegramOk === true && ' Bot token detected.'}
      </p>

      {error && (
        <p className="error">
          {error} {!isLoggedIn() && <Link href="/auth">Account →</Link>}
        </p>
      )}

      <div className="grid-2" style={{ marginTop: '1.1rem' }}>
        <form className="panel" onSubmit={onCreate}>
          <h3 className="panel-title">New alert</h3>
          <div className="field">
            <label htmlFor="aid">CoinGecko ID</label>
            <input id="aid" value={coingeckoId} onChange={(e) => setCoingeckoId(e.target.value)} />
          </div>
          <div className="field">
            <label>Direction</label>
            <div className="cta-row">
              <button
                type="button"
                className={`chip ${direction === 'above' ? 'active' : ''}`}
                onClick={() => setDirection('above')}
              >
                Above
              </button>
              <button
                type="button"
                className={`chip ${direction === 'below' ? 'active' : ''}`}
                onClick={() => setDirection('below')}
              >
                Below
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="target">Target USD</label>
            <input id="target" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <button className="btn" disabled={saving || !isLoggedIn()}>
            {saving ? 'Creating…' : 'Create alert'}
          </button>
        </form>

        <div className="panel">
          <h3 className="panel-title">Active alerts</h3>
          {!alerts.length && <p className="muted">No alerts yet.</p>}
          <table className="table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Rule</th>
                <th>Now</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/token/${a.coingeckoId}`}>
                      <strong>{a.symbol}</strong>
                    </Link>
                  </td>
                  <td>
                    {a.direction} {formatUsd(a.targetPrice, 4)}
                  </td>
                  <td>{a.currentPrice != null ? formatUsd(a.currentPrice, 4) : '—'}</td>
                  <td>
                    <span
                      className={`pill ${
                        a.status === 'sent' || a.status === 'triggered' ? 'bullish' : 'neutral'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn secondary" onClick={() => api.removeAlert(a.id).then(load)}>
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
