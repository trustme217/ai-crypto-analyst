import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { ScoringModule } from '../scoring/scoring.module';
import { SmartMoneyModule } from '../smart-money/smart-money.module';
import { HoldersModule } from '../holders/holders.module';
import { RiskModule } from '../risk/risk.module';
import { TokenAgent } from './token.agent';
import { WalletAgent } from './wallet.agent';
import { RiskAgent } from './risk.agent';
import { ResearchAgent } from './research.agent';
import { AgentOrchestrator } from './agent-orchestrator.service';

@Module({
  imports: [MarketModule, ScoringModule, SmartMoneyModule, HoldersModule, RiskModule],
  providers: [TokenAgent, WalletAgent, RiskAgent, ResearchAgent, AgentOrchestrator],
  exports: [AgentOrchestrator],
})
export class AgentsModule {}
