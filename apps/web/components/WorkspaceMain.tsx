'use client';

import { usePathname } from 'next/navigation';

export function WorkspaceMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const chatMode = pathname === '/chat' || pathname.startsWith('/chat/');

  return (
    <div className={chatMode ? 'workspace-main chat-mode' : 'workspace-main'}>
      {children}
      <footer className="footer">
        <span>© {new Date().getFullYear()} AI Crypto Analyst. All rights reserved.</span>
        <span>Research only — not financial advice.</span>
      </footer>
    </div>
  );
}
