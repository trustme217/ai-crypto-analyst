'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { api, isLoggedIn } from '@/lib/api';
import { useShell } from '@/components/ShellProvider';

export const CHAT_UPDATED_EVENT = 'aca-chat-updated';
export const GUEST_CHAT_KEY = 'aca_guest_chat_messages';

type HistoryItem = { id: string; title: string };

type StoredMsg = { id?: string; role: 'user' | 'assistant'; content: string; mode?: string };

function titleFrom(content: string) {
  const t = content.replace(/\s+/g, ' ').trim();
  if (t.length <= 48) return t || 'Untitled';
  return `${t.slice(0, 48)}…`;
}

function userTurnsFromMessages(
  messages: Array<{ id?: string; role: string; content: string }>,
): HistoryItem[] {
  const turns: HistoryItem[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    turns.push({ id: m.id || `u-${i}`, title: titleFrom(m.content) });
    if (turns.length >= 20) break;
  }
  return turns;
}

function readGuestMessages(): StoredMsg[] {
  try {
    const raw = localStorage.getItem(GUEST_CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredMsg[];
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
        const { messages } = await api.chatHistory();
        setItems(userTurnsFromMessages(messages));
      } else {
        setItems(userTurnsFromMessages(readGuestMessages()));
      }
    } catch {
      if (!loggedIn) setItems(userTurnsFromMessages(readGuestMessages()));
      else setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'aca_token' || e.key === GUEST_CHAT_KEY) refresh();
    };
    window.addEventListener(CHAT_UPDATED_EVENT, onUpdate);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHAT_UPDATED_EVENT, onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  function newChat() {
    router.push('/chat?new=1');
  }

  const focusId = searchParams.get('focus');
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
                Guest history stays in this browser. <Link href="/auth">Sign in</Link> to sync.
              </>
            )}
          </p>
        )}
        {!loading &&
          items.map((item) => {
            const active = onChat && focusId === item.id;
            return (
              <Link
                key={item.id}
                href={`/chat?focus=${encodeURIComponent(item.id)}`}
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
