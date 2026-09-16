import { Injectable } from '@nestjs/common';
import type { AgentBrief } from './agent.types';

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

@Injectable()
export class ResearchAgent {
  combine(token: AgentBrief, wallet: AgentBrief, risk: AgentBrief): AgentBrief {
    const score = Math.round(
      clamp(token.score * 0.45 + wallet.score * 0.25 + (100 - risk.score) * 0.3),
    );
    const findings = [
      `Token Agent ${token.score}/100 · Wallet Agent ${wallet.score}/100 · Risk Agent ${risk.score}/100 (higher risk = worse).`,
      token.findings[0],
      wallet.findings[0],
      risk.findings[0],
      'Research only — not financial advice.',
    ];
    return {
      name: 'research',
      title: 'Research Agent',
      score,
      checks: [
        { label: 'token', value: token.score },
        { label: 'wallet', value: wallet.score },
        { label: 'risk', value: risk.score },
        { label: 'composite', value: score },
      ],
      findings,
    };
  }
}
