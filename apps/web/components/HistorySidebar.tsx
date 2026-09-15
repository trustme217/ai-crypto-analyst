'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useShell } from '@/components/ShellProvider';

type HistoryItem = { id: string; title: string; href: string };

const DEFAULTS: HistoryItem[] = [
  { id: '1', title: 'Solana momentum vs BTC', href: '/chat' },
  { id: '2', title: 'ETH funding & basis', href: '/chat' },
  { id: '3', title: 'Jupiter liquidity check', href: '/analyze' },
  { id: '4', title: 'Watchlist refresh', href: '/watchlist' },
  { id: '5', title: 'Paper portfolio brief', href: '/portfolio' },
];

const STORAGE_KEY = 'aca-chat-history';

export function HistorySidebar() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { historyOpen, setHistoryOpen } = useShell();
  const [items, setItems] = useState<HistoryItem[]>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as HistoryItem[];
        if (Array.isArray(parsed) && parsed.length) setItems(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function newChat() {
    const next: HistoryItem = {
      id: String(Date.now()),
      title: 'New research chat',
      href: '/chat',
    };
    const updated = [next, ...items].slice(0, 12);
    setItems(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
    router.push('/chat');
  }

  return (
    <aside
      className={`history-pane${historyOpen ? '' : ' is-collapsed'}`}
      aria-label="Chat history"
      aria-hidden={!historyOpen}
    >
      <div className="history-head-row">
        <div className="history-head">Search Engine Chat</div>
        <button
          type="button"
          className="history-collapse"
          onClick={() => setHistoryOpen(false)}
          aria-label="Collapse menu"
          title="Collapse"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <button type="button" className="btn-new-chat" onClick={newChat} tabIndex={historyOpen ? 0 : -1}>
        <span aria-hidden>+</span> New Chat
      </button>
      <div className="history-list">
        {items.map((item) => {
          const active = pathname.startsWith(item.href) && item.href !== '/';
          return (
            <Link
              key={item.id}
              href={item.href}
              className={active ? 'history-item active' : 'history-item'}
              tabIndex={historyOpen ? 0 : -1}
            >
              <span className="history-dot" aria-hidden />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
