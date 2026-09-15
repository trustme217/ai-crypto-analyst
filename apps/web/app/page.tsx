'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, formatPct, formatUsd, type MarketOverview } from '@/lib/api';

function Spark({ values }: { values?: number[] }) {
  if (!values || values.length < 2) return <span className="muted">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 104;
  const h = 30;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        fill="none"
        stroke={up ? '#34d399' : '#fb7185'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function HomePage() {
  const [data, setData] = useState<MarketOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ id: string; name: string; symbol: string }>>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('q');
    if (fromUrl) setQ(fromUrl);
  }, []);

  useEffect(() => {
    api
      .overview()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .search(q)
        .then((r) => setResults(r.coins))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <main>
      <section className="hero">
        <div>
          <div className="live-dot">
            <i /> Live market desk
          </div>
          <h1 className="hero-brand">
            AI Crypto
            <em>Analyst</em>
          </h1>
          <p className="hero-copy">
            Read the tape with AI briefs, Solana wallet context, and live CoinGecko signals — research
            only, no custody.
          </p>
          <div className="cta-row">
            <Link className="btn" href="/signals">
              AI signals
            </Link>
            <Link className="btn secondary" href="/portfolio">
              Portfolio
            </Link>
            <Link className="btn secondary" href="/analyze">
              Analyze
            </Link>
          </div>
        </div>

        <div className="panel pulse-panel">
          <div className="eyebrow" style={{ marginBottom: '0.75rem' }}>
            Market pulse
          </div>
          {error && <p className="error">{error}</p>}
          {!data && !error && <p className="muted">Syncing feed…</p>}
          {data && (
            <div className="stats">
              <div className="stat">
                <div className="label">Market cap</div>
                <div className="value">{formatUsd(data.global.marketCap)}</div>
              </div>
              <div className="stat">
                <div className="label">24h volume</div>
                <div className="value">{formatUsd(data.global.volume24h)}</div>
              </div>
              <div className="stat">
                <div className="label">BTC dom</div>
                <div className="value">{data.global.btcDominance.toFixed(1)}%</div>
              </div>
              <div className="stat">
                <div className="label">Cap change</div>
                <div className={`value ${data.global.marketCapChange24h >= 0 ? 'up' : 'down'}`}>
                  {formatPct(data.global.marketCapChange24h)}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section grid-2">
        <div className="panel">
          <h2>Majors</h2>
          {!data ? (
            <p className="muted">Waiting for feed…</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Price</th>
                  <th>24h</th>
                  <th>7d</th>
                </tr>
              </thead>
              <tbody>
                {data.coins.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/token/${c.id}`} className="coin-cell">
                        <img src={c.image} alt="" />
                        <span>
                          <strong>{c.symbol.toUpperCase()}</strong>
                          <div className="muted">{c.name}</div>
                        </span>
                      </Link>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                      {formatUsd(c.current_price, 4)}
                    </td>
                    <td className={(c.price_change_percentage_24h || 0) >= 0 ? 'up' : 'down'}>
                      {formatPct(c.price_change_percentage_24h)}
                    </td>
                    <td>
                      <Spark values={c.sparkline_in_7d?.price} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h2>Find a token</h2>
          <div className="field">
            <label htmlFor="search">Search CoinGecko</label>
            <input
              id="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="bitcoin, solana, jupiter…"
            />
          </div>
          <div>
            {results.map((r) => (
              <Link key={r.id} href={`/token/${r.id}`} className="search-hit">
                <strong>{r.symbol.toUpperCase()}</strong>
                <span className="muted"> · {r.name}</span>
              </Link>
            ))}
            {!results.length && q.trim() && <p className="muted">No matches yet.</p>}
            {!q.trim() && (
              <p className="muted">Search any asset, then open it for an AI brief.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
