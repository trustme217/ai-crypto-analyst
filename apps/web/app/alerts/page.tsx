'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { api, formatUsd, isLoggedIn } from '@/lib/api';

type AlertRow = Awaited<ReturnType<typeof api.alerts>>['alerts'][number];
type SignalRow = Awaited<ReturnType<typeof api.signalFeed>>['signals'][number];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [telegramOk, setTelegramOk] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coingeckoId, setCoingeckoId] = useState('bitcoin');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [target, setTarget] = useState('80000');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const coin = new URLSearchParams(window.location.search).get('coin');
    if (coin) setCoingeckoId(coin);
  }, []);

  async function load() {
    try {
      const feed = await api.signalFeed();
      setSignals(feed.signals);
      setTypes(feed.types);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
    if (!isLoggedIn()) {
      return;
    }
    try {
      const res = await api.alerts();
      setAlerts(res.alerts);
      setTelegramOk(res.telegram?.botConfigured ?? null);
      if (res.types?.length) setTypes(res.types);
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

  async function onScan() {
    setScanning(true);
    try {
      const res = await api.scanSignals();
      setSignals(res.signals);
      setTypes(res.types);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScanning(false);
    }
  }

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Alerts</div>
        <h1>Signal-driven Telegram.</h1>
      </header>

      <p className="muted" style={{ marginTop: '0.5rem' }}>
        The alert queue emits SMART_MONEY_BUY, TOKEN_SCORE_CHANGE, WHALE_ACTIVITY, LIQUIDITY_DROP,
        RISK_CHANGE, AI_SIGNAL, PRICE, and VOLUME, then delivers over Telegram with retries.{' '}
        PRICE levels you create below still fire.{' '}
        <Link href="/settings">Settings</Link> for chat ID.
        {telegramOk === false && ' TELEGRAM_BOT_TOKEN is not set on the API yet.'}
        {telegramOk === true && ' Bot token detected.'}
      </p>

      {types.length > 0 && (
        <p className="muted" style={{ marginTop: '0.6rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
          {types.join(' · ')}
        </p>
      )}

      {error && (
        <p className="error">
          {error} {!isLoggedIn() && <Link href="/auth">Account →</Link>}
        </p>
      )}

      <div className="panel" style={{ marginTop: '1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
          <h3 className="panel-title" style={{ margin: 0 }}>
            Signal feed
          </h3>
          <button className="btn secondary" type="button" onClick={onScan} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Scan now'}
          </button>
        </div>
        {!signals.length && <p className="muted">No desk signals yet. Scan or wait for the 60s alert queue.</p>}
        <div className="grid-2" style={{ marginTop: '0.85rem' }}>
          {signals.map((s) => (
            <div
              key={s.id}
              style={{
                padding: '0.75rem 0.9rem',
                border: '1px solid var(--line)',
                borderRadius: 12,
                background: 'var(--panel-2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                <strong>{s.title}</strong>
                <span className="pill">{s.type}</span>
              </div>
              <p className="muted" style={{ margin: '0.25rem 0 0.5rem' }}>
                <Link href={`/token/${s.coingeckoId}`}>
                  ${s.symbol} / {s.name}
                </Link>
              </p>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {s.body}
              </pre>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: '1.1rem' }}>
        <form className="panel" onSubmit={onCreate}>
          <h3 className="panel-title">PRICE level</h3>
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
            {saving ? 'Creating…' : 'Create PRICE alert'}
          </button>
        </form>

        <div className="panel">
          <h3 className="panel-title">Your PRICE alerts</h3>
          {!isLoggedIn() && <p className="muted">Sign in to create personal price levels.</p>}
          {isLoggedIn() && !alerts.length && <p className="muted">No PRICE levels yet.</p>}
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
