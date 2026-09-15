'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, formatPct, formatUsd, type MarketOverview } from '@/lib/api';

export function TickerBar() {
  const [coins, setCoins] = useState<MarketOverview['coins']>([]);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    api
      .overview()
      .then((d) => {
        if (alive) setCoins(d.coins.slice(0, 8));
      })
      .catch(() => {
        if (alive) setCoins([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      if (!el) return;
      const mostlyVertical = Math.abs(e.deltaY) > Math.abs(e.deltaX);
      if (!mostlyVertical) return;
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY + e.deltaX;
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [coins.length]);

  return (
    <div className="ticker-bar">
      <div className="ticker-track" ref={trackRef} aria-label="Market ticker">
        {coins.map((c) => {
          const ch = c.price_change_percentage_24h ?? 0;
          return (
            <Link key={c.id} href={`/token/${c.id}`} className="ticker-pill">
              <img src={c.image} alt="" />
              <strong>{c.symbol.toUpperCase()}</strong>
              <span>{formatUsd(c.current_price, 4)}</span>
              <span className={ch >= 0 ? 'up' : 'down'}>{formatPct(ch)}</span>
            </Link>
          );
        })}
        {!coins.length && <span className="ticker-pill muted">Syncing markets…</span>}
      </div>
      <Link href="/signals" className="ticker-hot">
        Signals
      </Link>
    </div>
  );
}
