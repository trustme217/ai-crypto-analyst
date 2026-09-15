'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useShell } from '@/components/ShellProvider';

const LINKS = [
  { href: '/', label: 'Dashboard', icon: 'home' },
  { href: '/chat', label: 'Chat', icon: 'chat' },
  { href: '/signals', label: 'Signals', icon: 'signal' },
  { href: '/smart-money', label: 'Smart $', icon: 'copy' },
  { href: '/heatmap', label: 'Heatmap', icon: 'chart' },
  { href: '/analyze', label: 'Analyze', icon: 'chart' },
  { href: '/portfolio', label: 'Portfolio', icon: 'wallet' },
  { href: '/watchlist', label: 'Watchlist', icon: 'star' },
  { href: '/copy-trading', label: 'Copy', icon: 'copy' },
  { href: '/alerts', label: 'Alerts', icon: 'bell' },
  { href: '/wallet', label: 'Solana', icon: 'sol' },
  { href: '/settings', label: 'Settings', icon: 'gear' },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Icon({ name }: { name: (typeof LINKS)[number]['icon'] }) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'home':
      return (
        <svg {...props}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
        </svg>
      );
    case 'chat':
      return (
        <svg {...props}>
          <path d="M5 19l2.2-2.2A8 8 0 1 0 8.5 18.6L5 19z" />
        </svg>
      );
    case 'signal':
      return (
        <svg {...props}>
          <path d="M4 18V9M9 18V6M14 18v-8M19 18V4" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...props}>
          <path d="M4 19h16M6 15l4-5 3 3 5-7" />
        </svg>
      );
    case 'wallet':
      return (
        <svg {...props}>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18M16 14h2" />
        </svg>
      );
    case 'star':
      return (
        <svg {...props}>
          <path d="m12 3.5 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 7.2 18.4l.9-5.4L4.2 9.2l5.4-.8L12 3.5z" />
        </svg>
      );
    case 'copy':
      return (
        <svg {...props}>
          <rect x="8" y="8" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...props}>
          <path d="M6 16v-4a6 6 0 1 1 12 0v4l1.5 2H4.5L6 16zM10 20h4" />
        </svg>
      );
    case 'sol':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.1l1.6 1.5M17.5 15.4l1.6 1.5M3.5 12h2.2M18.3 12h2.2M4.9 16.9l1.6-1.5M17.5 8.6l1.6-1.5" />
        </svg>
      );
    default:
      return null;
  }
}

export function IconRail() {
  const pathname = usePathname() || '/';
  const { historyOpen, toggleHistory } = useShell();

  return (
    <aside className="icon-rail" aria-label="Primary">
      <Link href="/" className="rail-brand" title="AI Crypto Analyst">
        AI
      </Link>
      <button
        type="button"
        className={historyOpen ? 'rail-link active' : 'rail-link'}
        onClick={toggleHistory}
        aria-label={historyOpen ? 'Collapse menu' : 'Expand menu'}
        aria-expanded={historyOpen}
        title={historyOpen ? 'Collapse menu' : 'Expand menu'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
        </svg>
      </button>
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? 'rail-link active' : 'rail-link'}
            aria-label={link.label}
            aria-current={active ? 'page' : undefined}
            title={link.label}
          >
            <Icon name={link.icon} />
          </Link>
        );
      })}
      <div className="rail-spacer" />
      <Link
        href="/auth"
        className={isActive(pathname, '/auth') ? 'rail-link active' : 'rail-link'}
        aria-label="Account"
        title="Account"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="9" r="3.5" />
          <path d="M5.5 19.5c1.6-3 4-4.5 6.5-4.5s4.9 1.5 6.5 4.5" strokeLinecap="round" />
        </svg>
      </Link>
    </aside>
  );
}
