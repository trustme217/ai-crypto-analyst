'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, formatPct, type MarketOverview } from '@/lib/api';

function heatColor(pct: number) {
  const clamped = Math.max(-12, Math.min(12, pct));
  const t = (clamped + 12) / 24;
  const r = Math.round(251 + (52 - 251) * t);
  const g = Math.round(113 + (211 - 113) * t);
  const b = Math.round(133 + (153 - 133) * t);
  return `rgb(${r},${g},${b})`;
}

export default function HeatmapPage() {
  const [coins, setCoins] = useState<MarketOverview['coins']>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .overview()
      .then((d) => setCoins(d.coins))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Heatmap</div>
        <h1>24h performance grid.</h1>
      </header>
      <p className="muted">Top coins by market cap — color by 24h %. Research only.</p>
      {error && <p className="error">{error}</p>}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '0.65rem',
          marginTop: '1.1rem',
        }}
      >
        {coins.map((c) => {
          const ch = c.price_change_percentage_24h ?? 0;
          return (
            <Link
              key={c.id}
              href={`/token/${c.id}`}
              className="panel"
              style={{
                padding: '0.85rem',
                background: `${heatColor(ch)}22`,
                borderColor: heatColor(ch),
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <img src={c.image} alt="" width={18} height={18} />
                <strong>{c.symbol.toUpperCase()}</strong>
              </div>
              <div className={ch >= 0 ? 'up' : 'down'} style={{ marginTop: '0.45rem', fontFamily: 'var(--font-mono)' }}>
                {formatPct(ch)}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
