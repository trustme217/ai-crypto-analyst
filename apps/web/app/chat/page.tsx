'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, formatPct, formatUsd, type MarketOverview } from '@/lib/api';

type Msg = { role: 'user' | 'assistant'; content: string; mode?: string; chart?: boolean };

function PalmChart({ values, symbol }: { values?: number[]; symbol: string }) {
  if (!values || values.length < 2) return null;
  const w = 640;
  const h = 160;
  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  const line = pts.join(' ');
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const up = values[values.length - 1] >= values[0];

  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <h3>{symbol} Chart</h3>
        <div className="tf-row">
          <button type="button" className="active">
            7d
          </button>
          <button type="button">24h</button>
          <button type="button">1m</button>
        </div>
      </div>
      <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(167,139,250,0.35)" />
            <stop offset="100%" stopColor="rgba(167,139,250,0)" />
          </linearGradient>
        </defs>
        <polygon fill="url(#chartFill)" points={area} />
        <polyline
          fill="none"
          stroke="#a78bfa"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={line}
        />
      </svg>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.8rem' }}>
        <span className={up ? 'up' : 'down'}>{up ? 'Range bid' : 'Range ask'} · sparkline</span>
        <span className="muted">
          {formatUsd(min, 4)} – {formatUsd(max, 4)}
        </span>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        'Ask about market structure, token research, or Solana wallets. I stay in research mode — no trades, no custody.',
      mode: 'system',
      chart: true,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sol, setSol] = useState<MarketOverview['coins'][number] | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .overview()
      .then((d) => {
        const hit = d.coins.find((c) => c.id === 'solana') || d.coins[0] || null;
        setSol(hit);
      })
      .catch(() => setSol(null));
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    setError(null);
    try {
      const res = await api.chat(text);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, mode: res.mode }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-stage">
      <header className="chat-hero">
        <h1>Research ACA AI</h1>
        <div className="assistant-badge">
          <div className="assistant-avatar" aria-hidden>
            ◈
          </div>
          <div className="assistant-meta">
            <strong>Spectre Assistant</strong>
            <span>Online</span>
          </div>
        </div>
      </header>

      <div className="chat-log" ref={logRef}>
        {messages.map((m, i) => (
          <div key={`${m.role}-${i}`}>
            <div className={`bubble ${m.role}`}>
              {m.role === 'assistant' && (
                <div className="role-tag">
                  assistant{m.mode ? ` · ${m.mode}` : ''}
                </div>
              )}
              {m.content}
              {m.chart && sol && (
                <>
                  <PalmChart values={sol.sparkline_in_7d?.price} symbol={sol.symbol.toUpperCase()} />
                  <div className="overview-card">
                    <h3>Overview</h3>
                    <p>
                      {sol.name} ({sol.symbol.toUpperCase()}) is trading at{' '}
                      {formatUsd(sol.current_price, 4)} with a 24h move of{' '}
                      <span className={(sol.price_change_percentage_24h || 0) >= 0 ? 'up' : 'down'}>
                        {formatPct(sol.price_change_percentage_24h)}
                      </span>
                      . Ask a follow-up to dig into catalysts, risks, or Solana wallet context.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="bubble assistant">
            <div className="role-tag">assistant</div>
            Thinking…
          </div>
        )}
      </div>

      <div className="chat-composer">
        <form className="composer-shell" onSubmit={onSubmit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Start typing project name and question to search…"
            aria-label="Message"
            disabled={loading}
          />
          <button className="send-btn" type="submit" disabled={loading || !input.trim()} aria-label="Send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
