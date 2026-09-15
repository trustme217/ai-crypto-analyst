'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, formatUsd } from '@/lib/api';

/** Paper size estimator — not a DEX / not execution. */
export default function SwapPage() {
  const [coinId, setCoinId] = useState('solana');
  const [usd, setUsd] = useState('1000');
  const [price, setPrice] = useState<number | null>(null);
  const [symbol, setSymbol] = useState('SOL');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadCoin(id: string) {
    setLoading(true);
    try {
      const c = await api.coin(id.trim());
      setPrice(c.market.price);
      setSymbol(c.symbol.toUpperCase());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setPrice(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCoin(coinId);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    loadCoin(coinId);
  }

  const amount = price && Number(usd) > 0 ? Number(usd) / price : null;

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Paper size</div>
        <h1>Estimate a research size.</h1>
      </header>
      <p className="muted">
        Not a swap venue — converts USD notionals to token size at the live CoinGecko mark. No custody, no
        orders. For analysis, open <Link href="/analyze">Analyze</Link>.
      </p>

      <form className="panel" style={{ marginTop: '1.1rem', maxWidth: 480 }} onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="cid">CoinGecko ID</label>
          <input id="cid" value={coinId} onChange={(e) => setCoinId(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="usd">USD notional</label>
          <input id="usd" value={usd} onChange={(e) => setUsd(e.target.value)} />
        </div>
        <button className="btn" disabled={loading}>
          {loading ? 'Loading…' : 'Refresh mark'}
        </button>
        {error && <p className="error">{error}</p>}
        {price != null && (
          <div className="stats" style={{ marginTop: '1rem' }}>
            <div className="stat">
              <div className="label">{symbol} mark</div>
              <div className="value">{formatUsd(price, 4)}</div>
            </div>
            <div className="stat">
              <div className="label">Est. size</div>
              <div className="value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>
                {amount != null ? amount.toPrecision(6) : '—'} {symbol}
              </div>
            </div>
          </div>
        )}
      </form>
    </main>
  );
}
