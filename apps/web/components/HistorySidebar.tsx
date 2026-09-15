'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { api, isLoggedIn } from '@/lib/api';
import { useShell } from '@/components/ShellProvider';

export const CHAT_UPDATED_EVENT = 'aca-chat-updated';
export const GUEST_CHAT_KEY = 'aca_guest_chat_messages';
export const GUEST_SESSIONS_KEY = 'aca_guest_chat_sessions';

type HistoryItem = { id: string; title: string };

function titleFrom(content: string) {
  const t = content.replace(/\s+/g, ' ').trim();
  if (t.length <= 48) return t || 'Untitled';
  return `${t.slice(0, 48)}…`;
}

function readGuestSessions(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(GUEST_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function HistorySidebarInner() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const router = useRouter();
  const { historyOpen, setHistoryOpen } = useShell();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const loggedIn = isLoggedIn();
    setAuthed(loggedIn);
    setLoading(true);
    try {
      if (loggedIn) {
        const { sessions } = await api.chatSessions();
        setItems(sessions.map((s) => ({ id: s.id, title: s.title || 'Chat' })));
      } else {
        setItems(readGuestSessions());
      }
    } catch {
      if (!loggedIn) setItems(readGuestSessions());
      else setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'aca_token' || e.key === GUEST_SESSIONS_KEY || e.key === GUEST_CHAT_KEY) refresh();
    };
    window.addEventListener(CHAT_UPDATED_EVENT, onUpdate);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHAT_UPDATED_EVENT, onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  async function newChat() {
    if (isLoggedIn()) {
      try {
        const { session } = await api.createChatSession();
        router.push(`/chat?session=${encodeURIComponent(session.id)}&new=1`);
        window.dispatchEvent(new Event(CHAT_UPDATED_EVENT));
        return;
      } catch {
        /* fall through */
      }
    }
    const id = `g-${Date.now()}`;
    const next = [{ id, title: 'New research chat' }, ...readGuestSessions()].slice(0, 20);
    localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify(next));
    localStorage.setItem(`${GUEST_CHAT_KEY}:${id}`, JSON.stringify([]));
    router.push(`/chat?session=${encodeURIComponent(id)}&new=1`);
    window.dispatchEvent(new Event(CHAT_UPDATED_EVENT));
  }

  const sessionId = searchParams.get('session');
  const onChat = pathname === '/chat' || pathname.startsWith('/chat/');

  return (
    <aside
      className={`history-pane${historyOpen ? '' : ' is-collapsed'}`}
      aria-label="Chat history"
      aria-hidden={!historyOpen}
    >
      <div className="history-head-row">
        <div className="history-head">Research chats</div>
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
        {loading && (
          <p className="muted" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
            Loading…
          </p>
        )}
        {!loading && !items.length && (
          <p className="muted" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
            {authed ? (
              'No chats yet. Ask something on Chat.'
            ) : (
              <>
                Guest sessions stay in this browser. <Link href="/auth">Sign in</Link> to sync.
              </>
            )}
          </p>
        )}
        {!loading &&
          items.map((item) => {
            const active = onChat && sessionId === item.id;
            return (
              <Link
                key={item.id}
                href={`/chat?session=${encodeURIComponent(item.id)}`}
                className={active ? 'history-item active' : 'history-item'}
                tabIndex={historyOpen ? 0 : -1}
              >
                <span className="history-dot" aria-hidden />
                <span>{item.title || titleFrom(item.id)}</span>
              </Link>
            );
          })}
      </div>
    </aside>
  );
}

export function HistorySidebar() {
  return (
    <Suspense
      fallback={
        <aside className="history-pane" aria-label="Chat history">
          <div className="history-head-row">
            <div className="history-head">Research chats</div>
          </div>
        </aside>
      }
    >
      <HistorySidebarInner />
    </Suspense>
  );
}
