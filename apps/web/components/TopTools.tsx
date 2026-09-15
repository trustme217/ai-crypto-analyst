'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function TopTools() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/?q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="top-tools">
      <div className="project-chip">
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'linear-gradient(145deg,#a78bfa,#6d28d9)',
            display: 'inline-block',
          }}
          aria-hidden
        />
        $ACA
      </div>
      <Link href="/signals" className="tool-btn">
        Heatmaps
      </Link>
      <Link href="/analyze" className="tool-btn accent">
        Swap
      </Link>
      <form className="top-search" onSubmit={onSearch} role="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search token or ask a question…"
          aria-label="Search"
        />
      </form>
    </div>
  );
}
