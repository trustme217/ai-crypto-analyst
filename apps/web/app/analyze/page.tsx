'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, type AnalysisResult } from '@/lib/api';

const QUICK = [
  { id: 'bitcoin', label: 'BTC' },
  { id: 'ethereum', label: 'ETH' },
  { id: 'solana', label: 'SOL' },
  { id: 'chainlink', label: 'LINK' },
];

export default function AnalyzePage() {
  const [id, setId] = useState('solana');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.analyze(id.trim()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="section">
      <header className="page-head">
        <div className="eyebrow">AI analysis</div>
        <h1>Score a token in one pass.</h1>
      </header>
      <div className="grid-2" style={{ marginTop: '1.25rem' }}>
        <div className="panel">
          <div className="field">
            <label htmlFor="cg">CoinGecko ID</label>
            <input id="cg" value={id} onChange={(e) => setId(e.target.value)} placeholder="solana" />
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {QUICK.map((q) => (
              <button
                key={q.id}
                className={`chip ${id === q.id ? 'active' : ''}`}
                type="button"
                onClick={() => setId(q.id)}
              >
                {q.label}
              </button>
            ))}
          </div>
          <button className="btn" onClick={run} disabled={loading || !id.trim()}>
            {loading ? 'Working…' : 'Generate brief'}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
        <div className="panel">
          {!result && (
            <p className="muted">
              Results land here — heuristic by default, LLM if OPENAI_API_KEY is set.
            </p>
          )}
          {result && (
            <>
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                  marginBottom: '1rem',
                }}
              >
                <div className="score-ring">{result.analysis.score}</div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className={`pill ${result.analysis.sentiment}`}>
                    {result.analysis.sentiment}
                  </span>
                  <span className="pill">{result.analysis.mode}</span>
                </div>
              </div>
              <h3 className="panel-title">
                <Link href={`/token/${result.coin.id}`}>
                  {result.coin.name} ({result.coin.symbol.toUpperCase()})
                </Link>
              </h3>
              <p>{result.analysis.summary}</p>
              <p className="muted">{result.analysis.thesis}</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
