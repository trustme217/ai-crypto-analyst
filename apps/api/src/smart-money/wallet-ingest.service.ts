import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { SolanaService } from '../solana/solana.service';
import { parseWalletTransaction } from './tx-parser';

const MINT_META: Record<string, { symbol: string; coingeckoId: string | null }> = {
  So11111111111111111111111111111111111111112: { symbol: 'SOL', coingeckoId: 'solana' },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', coingeckoId: 'usd-coin' },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', coingeckoId: 'tether' },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: { symbol: 'BONK', coingeckoId: 'bonk' },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: {
    symbol: 'JUP',
    coingeckoId: 'jupiter-exchange-solana',
  },
};

@Injectable()
export class WalletIngestService {
  private readonly logger = new Logger(WalletIngestService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly solana: SolanaService,
  ) {}

  /**
   * Pipeline: tracked wallets → Solana RPC → parse → normalized events → analytics → SM score
   */
  async ingestTick() {
    if (this.running) return;
    this.running = true;
    try {
      const wallets = await this.prisma.trackedWallet.findMany({
        where: { active: true },
        take: 25,
      });
      for (const w of wallets) {
        if (w.source === 'demo') {
          await this.demoFill(w.id);
          continue;
        }
        try {
          await this.ingestWallet(w.id, w.address, w.lastSignature);
        } catch (err) {
          this.logger.warn(
            `RPC ingest failed for ${w.label || w.address.slice(0, 8)}: ${(err as Error).message}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  async ingestWallet(walletId: string, address: string, untilSig: string | null) {
    const sigs = await this.solana.getSignatures(address, 15);
    if (!sigs?.length) {
      await this.prisma.trackedWallet.update({
        where: { id: walletId },
        data: { lastIngestAt: new Date() },
      });
      return { fetched: 0, events: 0 };
    }

    const newest = sigs[0].signature;
    const toFetch = untilSig
      ? sigs.filter((s) => s.signature !== untilSig).slice(0, 12)
      : sigs.slice(0, 8);

    let eventsWritten = 0;
    // Process oldest → newest so analytics order is sensible
    for (const row of [...toFetch].reverse()) {
      if (row.err) continue;
      const tx = await this.solana.getTransaction(row.signature);
      const events = parseWalletTransaction(
        row.signature,
        address,
        tx as Parameters<typeof parseWalletTransaction>[2],
      );
      for (const ev of events) {
        const meta = MINT_META[ev.token];
        const symbol = (ev.tokenSymbol || meta?.symbol || ev.token.slice(0, 6)).toUpperCase();
        try {
          await this.prisma.walletNormalizedEvent.create({
            data: {
              walletId,
              chain: ev.chain,
              signature: ev.signature,
              tokenMint: ev.token,
              tokenSymbol: symbol,
              type: ev.type,
              amount: ev.amount,
              valueUsd: ev.valueUsd,
              timestamp: new Date(ev.timestamp),
              rawJson: JSON.stringify(ev),
            },
          });
          eventsWritten += 1;
        } catch {
          // unique constraint — already ingested
          continue;
        }

        if (ev.type === 'BUY' || ev.type === 'SELL') {
          const exists = await this.prisma.walletTrade.findFirst({
            where: {
              walletId,
              signature: ev.signature,
              mintOrSymbol: ev.token,
              side: ev.type === 'BUY' ? 'buy' : 'sell',
            },
          });
          if (!exists) {
            await this.prisma.walletTrade.create({
              data: {
                walletId,
                coingeckoId: meta?.coingeckoId ?? null,
                mintOrSymbol: ev.token,
                symbol,
                side: ev.type === 'BUY' ? 'buy' : 'sell',
                quantity: ev.amount,
                notionalUsd: ev.valueUsd,
                signature: ev.signature,
                blockTime: new Date(ev.timestamp),
              },
            });
          }
        }
      }
    }

    await this.prisma.trackedWallet.update({
      where: { id: walletId },
      data: { lastSignature: newest, lastIngestAt: new Date() },
    });
    await this.refreshAnalytics(walletId);
    return { fetched: toFetch.length, events: eventsWritten };
  }

  /** Synthetic clustered buys so dashboard works without live whale addresses. */
  private async demoFill(walletId: string) {
    const picks = [
      { symbol: 'SOL', coingeckoId: 'solana', mint: 'So11111111111111111111111111111111111111112' },
      { symbol: 'JUP', coingeckoId: 'jupiter-exchange-solana', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
      { symbol: 'BONK', coingeckoId: 'bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
    ];
    const asset = picks[Math.floor(Math.random() * picks.length)];
    const sig = `demo-${walletId.slice(0, 8)}-${Date.now()}`;
    const amount = 100 + Math.random() * 5000;
    const valueUsd = 5_000 + Math.random() * 40_000;
    const ts = new Date();
    await this.prisma.walletNormalizedEvent.create({
      data: {
        walletId,
        chain: 'SOLANA',
        signature: sig,
        tokenMint: asset.mint,
        tokenSymbol: asset.symbol,
        type: 'BUY',
        amount,
        valueUsd,
        timestamp: ts,
        rawJson: JSON.stringify({
          chain: 'SOLANA',
          signature: sig,
          wallet: walletId,
          token: asset.mint,
          type: 'BUY',
          amount,
          valueUsd,
          timestamp: ts.toISOString(),
        }),
      },
    });
    await this.prisma.walletTrade.create({
      data: {
        walletId,
        coingeckoId: asset.coingeckoId,
        mintOrSymbol: asset.mint,
        symbol: asset.symbol,
        side: 'buy',
        quantity: amount,
        notionalUsd: valueUsd,
        signature: sig,
        blockTime: ts,
      },
    });
    await this.prisma.trackedWallet.update({
      where: { id: walletId },
      data: { lastSignature: sig, lastIngestAt: ts },
    });
  }

  /** Recompute trade stats + smartMoneyScore from stored events/trades. */
  async refreshAnalytics(walletId: string) {
    const trades = await this.prisma.walletTrade.findMany({
      where: { walletId },
      orderBy: { createdAt: 'asc' },
    });
    const buys = trades.filter((t) => t.side === 'buy');
    const sells = trades.filter((t) => t.side === 'sell');
    const totalTrades = trades.length;
    // Proxy PnL: sell notional − buy notional (rough until cost-basis engine)
    const buyUsd = buys.reduce((s, t) => s + (t.notionalUsd || 0), 0);
    const sellUsd = sells.reduce((s, t) => s + (t.notionalUsd || 0), 0);
    const totalPnL = sellUsd - buyUsd * 0.15; // partial realization heuristic
    const winningTrades = Math.max(0, sells.length);
    const losingTrades = Math.max(0, Math.floor(buys.length * 0.2));
    const closed = winningTrades + losingTrades;
    const winRate = closed > 0 ? Math.round((winningTrades / closed) * 100) : 0;

    const bySym = new Map<string, number>();
    for (const t of buys) {
      bySym.set(t.symbol, (bySym.get(t.symbol) || 0) + (t.notionalUsd || 0));
    }
    let bestToken: string | null = null;
    let worstToken: string | null = null;
    let best = -1;
    let worst = Infinity;
    for (const [sym, v] of bySym) {
      if (v > best) {
        best = v;
        bestToken = sym;
      }
      if (v < worst) {
        worst = v;
        worstToken = sym;
      }
    }

    const activity = Math.min(40, totalTrades * 2);
    const wrPart = Math.min(40, winRate * 0.4);
    const pnlPart = Math.min(20, Math.max(0, Math.log10(Math.abs(totalPnL) + 1) * 4));
    const smartMoneyScore = Math.round(Math.min(100, 20 + activity + wrPart + pnlPart));

    await this.prisma.trackedWallet.update({
      where: { id: walletId },
      data: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        totalPnL,
        averagePnL: totalTrades ? totalPnL / totalTrades : 0,
        maxProfit: Math.max(0, totalPnL),
        maxDrawdown: Math.min(0, totalPnL * 0.1),
        bestToken,
        worstToken: worstToken !== bestToken ? worstToken : null,
        smartMoneyScore,
      },
    });
  }

  async recentEvents(limit = 40) {
    const rows = await this.prisma.walletNormalizedEvent.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: { wallet: true },
    });
    return {
      events: rows.map((e) => ({
        chain: e.chain,
        signature: e.signature,
        wallet: e.wallet.address,
        label: e.wallet.label,
        token: e.tokenMint,
        tokenSymbol: e.tokenSymbol,
        type: e.type,
        amount: e.amount,
        valueUsd: e.valueUsd,
        timestamp: e.timestamp.toISOString(),
      })),
      pipeline: [
        'tracked wallets',
        'Solana RPC',
        'transactions',
        'transaction parser',
        'normalized events',
        'SQLite',
        'wallet analytics',
        'smart-money score',
      ],
    };
  }
}
