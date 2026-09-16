import { Injectable } from '@nestjs/common';
import { HoldersService } from '../holders/holders.service';
import { RiskEngineService } from '../risk/risk-engine.service';
import type { AgentBrief } from './agent.types';

@Injectable()
export class RiskAgent {
  constructor(
    private readonly holders: HoldersService,
    private readonly risk: RiskEngineService,
  ) {}

  async run(input: {
    coingeckoId: string;
    symbol: string;
    marketCap: number;
    volume24h: number;
    change24h: number;
    change7d: number | null;
    categories: string[];
  }): Promise<{ brief: AgentBrief; intel: Awaited<ReturnType<HoldersService['getIntelligence']>>; riskReport: Awaited<ReturnType<RiskEngineService['evaluate']>> }> {
    const intel = await this.holders.getIntelligence({
      coingeckoId: input.coingeckoId,
      symbol: input.symbol,
      marketCap: input.marketCap,
      marketCapRank: null,
      volume24h: input.volume24h,
    });
    const riskReport = await this.risk.evaluate({
      coingeckoId: input.coingeckoId,
      symbol: input.symbol,
      marketCap: input.marketCap,
      volume24h: input.volume24h,
      change24h: input.change24h,
      change7d: input.change7d,
      categories: input.categories,
      holderConcentration: intel.holderConcentration,
      creatorOwnership: intel.creatorOwnership,
    });
    const findings = [
      `Risk Score ${riskReport.riskScore}/100 (deterministic).`,
      `Holders ${intel.holders.toLocaleString()} · top10 ${intel.top10Pct}% · creator ${intel.creatorOwnership}%.`,
      intel.alerts[0]?.detail || `Sell pressure ${riskReport.sellPressure}/100.`,
    ];
    return {
      intel,
      riskReport,
      brief: {
        name: 'risk',
        title: 'Risk Agent',
        score: riskReport.riskScore,
        checks: [
          { label: 'liquidity', value: riskReport.liquidityScore },
          { label: 'holders', value: intel.holders },
          { label: 'concentration', value: intel.holderConcentration },
          { label: 'creator', value: intel.creatorOwnership },
          { label: 'sell pressure', value: riskReport.sellPressure },
        ],
        findings,
      },
    };
  }
}
