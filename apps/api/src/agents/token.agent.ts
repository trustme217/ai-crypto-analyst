import { Injectable } from '@nestjs/common';
import { TokenScoreService } from '../scoring/token-score.service';
import type { AgentBrief } from './agent.types';

@Injectable()
export class TokenAgent {
  constructor(private readonly tokenScore: TokenScoreService) {}

  run(input: {
    symbol: string;
    price: number;
    marketCap: number;
    volume24h: number;
    change24h: number;
    change7d: number | null;
    marketCapRank: number | null;
    smartMoneyScore?: number | null;
    holderQualityScore?: number | null;
    riskScore?: number | null;
  }): AgentBrief {
    const scores = this.tokenScore.score(input);
    const volMcap = input.marketCap > 0 ? input.volume24h / input.marketCap : 0;
    const findings = [
      `Price ${input.price} with 24h ${input.change24h >= 0 ? '+' : ''}${input.change24h.toFixed(2)}%.`,
      `Volume/mcap ${(volMcap * 100).toFixed(2)}% — liquidity ${scores.liquidity}/100, volume ${scores.volume}/100.`,
      `Momentum ${scores.momentum}/100 (24h + 7d blend). Token Score ${scores.score}/100.`,
    ];
    return {
      name: 'token',
      title: 'Token Agent',
      score: scores.score,
      checks: [
        { label: 'price', value: input.price },
        { label: 'volume', value: Math.round(input.volume24h) },
        { label: 'liquidity', value: scores.liquidity },
        { label: 'market cap', value: Math.round(input.marketCap) },
        { label: 'momentum', value: scores.momentum },
      ],
      findings,
    };
  }
}
