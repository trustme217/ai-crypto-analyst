'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, formatPct, formatUsd, type AnalysisResult, type CoinDetail } from '@/lib/api';

type HolderIntel = Awaited<ReturnType<typeof api.holders>>;
type RiskReport = Awaited<ReturnType<typeof api.riskEngine>>;

export default function TokenPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [coin, setCoin] = useState<CoinDetail | null>(null);
  const [holders, setHolders] = useState<HolderIntel | null>(null);
  const [risk, setRisk] = useState<RiskReport | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);
  const [watchMsg, setWatchMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.coin(id), api.isWatched(id).catch(() => false)])
      .then(async ([c, watched]) => {
        setCoin(c);
        setWatching(watched);
        try {
          const [h, r] = await Promise.all([
            api.holders(c.id, c.symbol),
            api.riskEngine(c.id, c.symbol),
          ]);
          setHolders(h);
          setRisk(r);
        } catch {
          setHolders(null);
          setRisk(null);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function runAnalysis() {
    setAnalyzing(true);
    setError(null);
    try {
      setAnalysis(await api.analyze(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function toggleWatch() {
    if (!coin) return;
    setWatchBusy(true);
    setWatchMsg(null);
    setError(null);
    try {
      if (watching) {
        await api.removeWatch(coin.id);
        setWatching(false);
        setWatchMsg('Removed from watchlist.');
      } else {
        const res = await api.addWatch(coin.id, {
          symbol: coin.symbol,
          name: coin.name,
        });
        setWatching(true);
        setWatchMsg(
          res.mode === 'guest'
            ? 'Saved to guest watchlist. Sign in later to sync across devices.'
            : 'Added to your watchlist.',
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWatchBusy(false);
    }
  }

  if (loading)
    return (
      <main className="section">
        <p className="muted">Loading token…</p>
      </main>
    );
  if (!coin)
    return (
      <main className="section">
        <header className="page-head">
          <div className="eyebrow">Token</div>
          <h1>{id}</h1>
        </header>
        <div className="panel" style={{ marginTop: '1rem' }}>
          <p className="error">{error || 'Token not found'}</p>
          {(error || '').toLowerCase().includes('rate') || (error || '').includes('429') ? (
            <p className="muted">
              CoinGecko free tier is throttling requests. Wait ~30s, then retry. Optional: add a free
              demo key as <code>COINGECKO_API_KEY</code> in <code>.env</code>.
            </p>
          ) : null}
          <div className="cta-row" style={{ marginTop: '1rem' }}>
            <button
              className="btn"
              onClick={() => {
                setLoading(true);
                setError(null);
                Promise.all([api.coin(id), api.isWatched(id).catch(() => false)])
                  .then(([c, watched]) => {
                    setCoin(c);
                    setWatching(watched);
                  })
                  .catch((e: Error) => setError(e.message))
                  .finally(() => setLoading(false));
              }}
            >
              Retry
            </button>
            <Link className="btn secondary" href="/">
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
    );

  return (
    <main className="section">
      <div className="grid-2">
        <div className="panel">
          <div className="coin-cell" style={{ marginBottom: '1.1rem' }}>
            <img src={coin.image} alt="" width={48} height={48} style={{ borderRadius: '50%' }} />
            <div>
              <div className="eyebrow">{coin.symbol.toUpperCase()}</div>
              <h2 className="panel-title" style={{ margin: 0, fontSize: '1.6rem' }}>
                {coin.name}
              </h2>
            </div>
          </div>
          <div className="stats">
            <div className="stat">
              <div className="label">Price</div>
              <div className="value">{formatUsd(coin.market.price, 6)}</div>
            </div>
            <div className="stat">
              <div className="label">24h</div>
              <div className={`value ${coin.market.change24h >= 0 ? 'up' : 'down'}`}>
                {formatPct(coin.market.change24h)}
              </div>
            </div>
            <div className="stat">
              <div className="label">Market cap</div>
              <div className="value">{formatUsd(coin.market.marketCap)}</div>
            </div>
            <div className="stat">
              <div className="label">Volume</div>
              <div className="value">{formatUsd(coin.market.volume24h)}</div>
            </div>
          </div>
          <p className="muted" style={{ marginTop: '1rem', lineHeight: 1.55 }}>
            {coin.description || 'No description available.'}
          </p>
          <div className="cta-row" style={{ marginTop: '1.1rem' }}>
            <button className="btn" onClick={runAnalysis} disabled={analyzing}>
              {analyzing ? 'Analyzing…' : 'AI Analyze'}
            </button>
            <button className={`btn ${watching ? 'secondary' : ''}`} onClick={toggleWatch} disabled={watchBusy}>
              {watchBusy ? 'Saving…' : watching ? 'Watching ✓' : 'Watch'}
            </button>
            <Link className="btn secondary" href="/alerts">
              Set alert
            </Link>
            <Link className="btn secondary" href="/signals">
              Signals
            </Link>
          </div>
          {watchMsg && <p className="muted">{watchMsg}</p>}
          {error && <p className="error">{error}</p>}
        </div>

        <div className="panel">
          <h3 className="panel-title">Holder intelligence</h3>
          {!holders && <p className="muted">Loading distribution metrics…</p>}
          {holders && (
            <>
              <p className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                Source: {holders.source} · quality {holders.holderQualityScore}/100 (feeds Token Score
                Hold 15%)
              </p>
              <div className="stats">
                <div className="stat">
                  <div className="label">Holders</div>
                  <div className="value">{holders.holders.toLocaleString()}</div>
                </div>
                <div className="stat">
                  <div className="label">Top 10 %</div>
                  <div className="value">{holders.top10Pct}%</div>
                </div>
                <div className="stat">
                  <div className="label">Top 20 %</div>
                  <div className="value">{holders.top20Pct}%</div>
                </div>
                <div className="stat">
                  <div className="label">Concentration</div>
                  <div className="value">{holders.holderConcentration}%</div>
                </div>
                <div className="stat">
                  <div className="label">Smart money</div>
                  <div className="value">{holders.smartMoneyOwnership}%</div>
                </div>
                <div className="stat">
                  <div className="label">Whales</div>
                  <div className="value">{holders.whaleOwnership}%</div>
                </div>
                <div className="stat">
                  <div className="label">Creator</div>
                  <div className="value">{holders.creatorOwnership}%</div>
                </div>
              </div>
              {holders.alerts.map((a) => (
                <div
                  key={a.type + a.detail}
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.75rem 0.9rem',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    background: 'var(--panel-2)',
                  }}
                >
                  <strong>
                    {a.risk === 'HIGH' ? '⚠ ' : ''}
                    {a.title}
                  </strong>
                  <div className="muted" style={{ marginTop: '0.35rem', fontSize: '0.9rem' }}>
                    {a.detail}
                  </div>
                  <div style={{ marginTop: '0.35rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    Risk: <span className={a.risk === 'HIGH' ? 'down' : ''}>{a.risk}</span>
                  </div>
                </div>
              ))}
              {holders.distributionChanges.length > 0 && (
                <p className="muted" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
                  Distribution changes:{' '}
                  {holders.distributionChanges
                    .map((d) => `${d.metric} ${d.delta > 0 ? '+' : ''}${d.delta}`)
                    .join(' · ')}
                </p>
              )}
            </>
          )}
        </div>

        <div className="panel">
          <h3 className="panel-title">Risk Engine</h3>
          {!risk && <p className="muted">Loading deterministic risk…</p>}
          {risk && (
            <>
              <p className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                Calculated before AI. LLM may explain these numbers — it does not invent them.
              </p>
              <table className="table">
                <tbody>
                  {(
                    [
                      ['Liquidity', risk.breakdown.liquidity],
                      ['Holder concentration', risk.breakdown.holderConcentration],
                      ['Creator holdings', risk.breakdown.creatorHoldings],
                      ['Sell pressure', risk.breakdown.sellPressure],
                      ['Volume anomaly', risk.breakdown.volumeAnomaly],
                      ['Contract risk', risk.breakdown.contractRisk],
                    ] as const
                  ).map(([label, value]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{value}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <strong>Risk Score</strong>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                      <strong>{risk.riskScore}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
              <pre
                style={{
                  marginTop: '0.85rem',
                  padding: '0.75rem 0.9rem',
                  borderRadius: 12,
                  background: 'var(--panel-2)',
                  fontSize: '0.8rem',
                  overflowX: 'auto',
                }}
              >
                {JSON.stringify(risk.aiJson, null, 2)}
              </pre>
            </>
          )}
        </div>

        <div className="panel">
          <h3 className="panel-title">AI brief</h3>
          {!analysis && <p className="muted">Run analysis to generate a scored research brief.</p>}
          {analysis && (
            <div>
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                  marginBottom: '0.9rem',
                }}
              >
                <div className="score-ring">{analysis.analysis.score}</div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className={`pill ${analysis.analysis.sentiment}`}>
                    {analysis.analysis.sentiment}
                  </span>
                  <span className="pill">{analysis.analysis.mode}</span>
                </div>
              </div>
              <p>{analysis.analysis.summary}</p>
              <h3 className="panel-title">Thesis</h3>
              <p className="muted">{analysis.analysis.thesis}</p>
              <h3 className="panel-title">Catalysts</h3>
              <ul>
                {analysis.analysis.catalysts.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <h3 className="panel-title">Risks</h3>
              <ul>
                {analysis.analysis.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              {(analysis.riskEngine || analysis.analysis.riskEngine) && (
                <>
                  <h3 className="panel-title">Risk Engine (input to AI)</h3>
                  <pre
                    style={{
                      padding: '0.75rem 0.9rem',
                      borderRadius: 12,
                      background: 'var(--panel-2)',
                      fontSize: '0.8rem',
                      overflowX: 'auto',
                    }}
                  >
                    {JSON.stringify(analysis.riskEngine || analysis.analysis.riskEngine, null, 2)}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
