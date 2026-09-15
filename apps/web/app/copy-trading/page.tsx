'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, formatPct, isLoggedIn, type CopyLeader } from '@/lib/api';

export default function CopyTradingPage() {
  const [leaders, setLeaders] = useState<CopyLeader[]>([]);
  const [follows, setFollows] = useState<string[]>([]);
  const [trades, setTrades] = useState<
    Awaited<ReturnType<typeof api.copyTrades>>['trades']
  >([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [alloc, setAlloc] = useState(10);

  async function load() {
    try {
      const leadersRes = await api.copyLeaders();
      setLeaders(leadersRes.leaders);
      setDisclaimer(leadersRes.disclaimer);
      if (isLoggedIn()) {
        const f = await api.copyFollows();
        setFollows(f.follows.map((x) => x.traderId));
        const t = await api.copyTrades();
        setTrades(t.trades);
      } else {
        setFollows([]);
        setTrades([]);
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(traderId: string) {
    if (!isLoggedIn()) {
      setError('Sign in on Account to follow a desk.');
      return;
    }
    try {
      if (follows.includes(traderId)) await api.unfollowTrader(traderId);
      else await api.followTrader(traderId, alloc);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Copy trading</div>
        <h1>Follow paper desks.</h1>
      </header>
      {disclaimer && <p className="muted">{disclaimer}</p>}
      {error && (
        <p className="error">
          {error} {!isLoggedIn() && <Link href="/auth">Account →</Link>}
        </p>
      )}

      <div className="field" style={{ maxWidth: 220, marginTop: '1rem' }}>
        <label htmlFor="alloc">Allocation %</label>
        <input
          id="alloc"
          type="number"
          min={1}
          max={100}
          value={alloc}
          onChange={(e) => setAlloc(Number(e.target.value) || 10)}
        />
      </div>

      <div className="grid-3" style={{ marginTop: '1rem' }}>
        {leaders.map((l) => (
          <div key={l.id} className="panel">
            <h3 className="panel-title">{l.name}</h3>
            <p className="muted">{l.bio}</p>
            <div className="stats" style={{ marginTop: '0.75rem' }}>
              <div className="stat">
                <div className="label">Win rate</div>
                <div className="value">{l.winRate}%</div>
              </div>
              <div className="stat">
                <div className="label">30d</div>
                <div className={`value ${l.avgReturn30d >= 0 ? 'up' : 'down'}`}>
                  {formatPct(l.avgReturn30d)}
                </div>
              </div>
            </div>
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Focus: {l.focus.join(', ')} · Risk {l.risk} · {l.followers} followers
            </p>
            <button
              className={`btn ${follows.includes(l.id) ? 'secondary' : ''}`}
              style={{ marginTop: '0.85rem' }}
              onClick={() => toggle(l.id)}
            >
              {follows.includes(l.id) ? 'Unfollow' : 'Follow'}
            </button>
          </div>
        ))}
      </div>

      {isLoggedIn() && (
        <div className="panel" style={{ marginTop: '1.25rem' }}>
          <h3 className="panel-title">Recent paper fills</h3>
          {!trades.length && (
            <p className="muted">No simulated fills yet — they appear every few minutes while you follow a desk.</p>
          )}
          {!!trades.length && (
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Desk</th>
                  <th>Side</th>
                  <th>Asset</th>
                  <th>Qty</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id}>
                    <td className="muted" style={{ fontSize: '0.8rem' }}>
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                    <td>{t.traderId}</td>
                    <td>
                      <span className={`pill ${t.side === 'buy' ? 'bullish' : 'bearish'}`}>{t.side}</span>
                    </td>
                    <td>
                      <Link href={`/token/${t.coingeckoId}`}>
                        <strong>{t.symbol}</strong>
                      </Link>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{t.quantity}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      ${t.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </main>
  );
}
