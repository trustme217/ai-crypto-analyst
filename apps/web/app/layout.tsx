import type { Metadata } from 'next';
import { HistorySidebar } from '@/components/HistorySidebar';
import { IconRail } from '@/components/IconRail';
import { ShellProvider } from '@/components/ShellProvider';
import { TickerBar } from '@/components/TickerBar';
import { TopTools } from '@/components/TopTools';
import { WorkspaceMain } from '@/components/WorkspaceMain';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Crypto Analyst',
  description: 'AI signals, portfolio, copy trading, alerts, and Solana research desk.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&family=Sora:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ShellProvider>
          <div className="app-frame">
            <IconRail />
            <HistorySidebar />
            <div className="workspace">
              <header className="workspace-top">
                <TopTools />
                <TickerBar />
              </header>
              <WorkspaceMain>{children}</WorkspaceMain>
            </div>
          </div>
        </ShellProvider>
      </body>
    </html>
  );
}
