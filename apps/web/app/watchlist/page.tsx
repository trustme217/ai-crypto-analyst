'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Item = { id: string; coingeckoId: string; symbol: string; name: string };

export default function WatchlistPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<'guest' | 'account' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await api.watchlist();
      setItems(res.items);
      setMode(res.mode);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    await api.removeWatch(id);
    await load();
  }

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Saved</div>
        <h1>Watchlist</h1>
      </header>
      <div className="panel" style={{ marginTop: '1.25rem' }}>
        {mode && (
          <p className="muted">
            Mode: <strong>{mode}</strong>
            {mode === 'guest'
              ? ' — saved in this browser. Create an account to sync.'
              : ' — synced to your account.'}{' '}
            Open any <Link href="/">token</Link> and hit Watch.
          </p>
        )}
        {error && <p className="error">{error}</p>}
        {!error && !items.length && (
          <p className="muted">
            No saved tokens yet. Open a token page and hit <strong>Watch</strong>.
          </p>
        )}
        <table className="table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Name</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link href={`/token/${item.coingeckoId}`}>
                    <strong style={{ fontFamily: 'var(--font-display)' }}>{item.symbol}</strong>
                  </Link>
                </td>
                <td>{item.name}</td>
                <td>
                  <button className="btn secondary" onClick={() => remove(item.coingeckoId)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
