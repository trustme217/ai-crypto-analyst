import { Injectable } from '@nestjs/common';
import { MarketService } from '../market/market.service';
import { TokenAgent } from './token.agent';
import { WalletAgent } from './wallet.agent';
import { RiskAgent } from './risk.agent';
import { ResearchAgent } from './research.agent';
import type { OrchestratorResult } from './agent.types';

@Injectable()
export class AgentOrchestrator {
  constructor(
    private readonly market: MarketService,
    private readonly tokenAgent: TokenAgent,
    private readonly walletAgent: WalletAgent,
    private readonly riskAgent: RiskAgent,
    private readonly researchAgent: ResearchAgent,
  ) {}

  async run(coingeckoId: string): Promise<{
    desk: OrchestratorResult;
    coin: Awaited<ReturnType<MarketService['getCoin']>>;
    intel: Awaited<ReturnType<RiskAgent['run']>>['intel'];
    riskReport: Awaited<ReturnType<RiskAgent['run']>>['riskReport'];
  }> {
    const coin = await this.market.getCoin(coingeckoId);

    const [wallet, riskPack] = await Promise.all([
      this.walletAgent.run(coin.symbol),
      this.riskAgent.run({
        coingeckoId: coin.id,
        symbol: coin.symbol,
        marketCap: coin.market.marketCap,
        volume24h: coin.market.volume24h,
        change24h: coin.market.change24h,
        change7d: coin.market.change7d,
        categories: coin.categories || [],
      }),
    ]);

    const token = this.tokenAgent.run({
      symbol: coin.symbol,
      price: coin.market.price,
      marketCap: coin.market.marketCap,
      volume24h: coin.market.volume24h,
      change24h: coin.market.change24h,
      change7d: coin.market.change7d,
      marketCapRank: null,
      smartMoneyScore: wallet.score,
      holderQualityScore: riskPack.intel.holderQualityScore,
      riskScore: riskPack.riskReport.riskScore,
    });

    const research = this.researchAgent.combine(token, wallet, riskPack.brief);

    return {
      coin,
      intel: riskPack.intel,
      riskReport: riskPack.riskReport,
      desk: {
        graph: [
          ['AI Orchestrator'],
          ['Token Agent', 'Wallet Agent', 'Risk Agent'],
          ['Research Agent'],
          ['Final Analysis'],
        ],
        agents: {
          token,
          wallet,
          risk: riskPack.brief,
          research,
        },
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
