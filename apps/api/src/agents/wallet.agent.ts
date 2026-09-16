import { Injectable } from '@nestjs/common';
import { SmartMoneyService } from '../smart-money/smart-money.service';
import type { AgentBrief } from './agent.types';

@Injectable()
export class WalletAgent {
  constructor(private readonly smart: SmartMoneyService) {}

  async run(symbol: string): Promise<AgentBrief> {
    const [wallets, signals] = await Promise.all([
      this.smart.listWallets(),
      this.smart.recentSignals(60),
    ]);
    const sig = signals.signals.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
    const sm = await this.smart.scoreForSymbol(symbol, 60);
    const tracked = wallets.wallets.slice(0, 5);
    const buyers = sig?.wallets ?? [];
    const avgWin = tracked.length
      ? Math.round(tracked.reduce((s, w) => s + w.winRate, 0) / tracked.length)
      : 0;
    const findings = [
      buyers.length
        ? `${buyers.length} tracked wallet${buyers.length === 1 ? '' : 's'} bought ${symbol.toUpperCase()} in the last hour.`
        : `No clustered tracked buys for ${symbol.toUpperCase()} in the last 60 minutes.`,
      `Tracked desk win rate ~${avgWin}%. Smart-money score ${sm ?? 'n/a'}/100.`,
      tracked[0]
        ? `Top wallet ${tracked[0].label || tracked[0].address.slice(0, 8)} — SM ${tracked[0].smartMoneyScore}, PnL ${tracked[0].totalPnL}.`
        : 'No tracked wallets seeded.',
    ];
    return {
      name: 'wallet',
      title: 'Wallet Agent',
      score: sm ?? 50,
      checks: [
        { label: 'who is buying', value: buyers.length ? buyers.map((b) => b.label || b.address.slice(0, 6)).join(', ') : 'none clustered' },
        { label: 'wallet profitability', value: avgWin, note: 'avg win rate %' },
        { label: 'wallet history', value: tracked.reduce((s, w) => s + w.totalTrades, 0), note: 'tracked trades' },
        { label: 'smart-money activity', value: sm ?? 0 },
      ],
      findings,
    };
  }
}
