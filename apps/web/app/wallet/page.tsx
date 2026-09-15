'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';

type Wallet = Awaited<ReturnType<typeof api.wallet>>;

export default function WalletPage() {
  const [address, setAddress] = useState('');
  const [data, setData] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setData(await api.wallet(address.trim()));
    } catch (err) {
      setData(null);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">Solana</div>
        <h1>Inspect a public wallet.</h1>
      </header>
      <form className="panel" onSubmit={onSubmit} style={{ marginTop: '1.25rem' }}>
        <div className="field">
          <label htmlFor="addr">Wallet address</label>
          <input
            id="addr"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Base58 Solana address"
          />
        </div>
        <button className="btn" disabled={loading || !address.trim()}>
          {loading ? 'Querying RPC…' : 'Lookup'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      {data && (
        <div className="grid-2" style={{ marginTop: '1.1rem' }}>
          <div className="panel">
            <h3 className="panel-title">Balance</h3>
            <div className="stats">
              <div className="stat">
                <div className="label">SOL</div>
                <div className="value">{(data.solBalance ?? 0).toFixed(4)}</div>
              </div>
              <div className="stat">
                <div className="label">SPL tokens</div>
                <div className="value">{data.tokenCount ?? 0}</div>
              </div>
            </div>
            <p className="muted" style={{ marginTop: '0.85rem', wordBreak: 'break-all' }}>
              {data.address}
            </p>
            <a className="btn secondary" href={data.explorerUrl} target="_blank" rel="noreferrer">
              Open Solscan
            </a>
          </div>
          <div className="panel">
            <h3 className="panel-title">Holdings</h3>
            {!data.tokens?.length && <p className="muted">No non-zero SPL balances found.</p>}
            <table className="table">
              <thead>
                <tr>
                  <th>Mint</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(data.tokens || []).map((t) => (
                  <tr key={t.account}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      {t.mint.slice(0, 4)}…{t.mint.slice(-4)}
                    </td>
                    <td>{t.amount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="panel-title" style={{ marginTop: '1rem' }}>
              Recent signatures
            </h3>
            <ul>
              {(data.recentSignatures || []).map((s) => (
                <li key={s.signature} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                  {s.signature.slice(0, 16)}… · slot {s.slot}
                  {s.blockTime ? ` · ${new Date(s.blockTime * 1000).toLocaleString()}` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
