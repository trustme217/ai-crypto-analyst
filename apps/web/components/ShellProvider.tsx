'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ShellContextValue = {
  historyOpen: boolean;
  toggleHistory: () => void;
  setHistoryOpen: (open: boolean) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

const STORAGE_KEY = 'aca-history-open';

export function ShellProvider({ children }: { children: ReactNode }) {
  const [historyOpen, setHistoryOpenState] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === '0') setHistoryOpenState(false);
      if (raw === '1') setHistoryOpenState(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setHistoryOpen = useCallback((open: boolean) => {
    setHistoryOpenState(open);
    try {
      localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleHistory = useCallback(() => {
    setHistoryOpenState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ historyOpen, toggleHistory, setHistoryOpen }),
    [historyOpen, toggleHistory, setHistoryOpen],
  );

  return (
    <ShellContext.Provider value={value}>
      <div
        className={`app-shell${historyOpen ? '' : ' history-collapsed'}${ready ? ' shell-ready' : ''}`}
      >
        {children}
      </div>
    </ShellContext.Provider>
  );
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}
