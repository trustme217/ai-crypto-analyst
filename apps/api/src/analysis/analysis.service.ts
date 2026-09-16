import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StoreService } from '../store/store.service';
import { RiskEngineService } from '../risk/risk-engine.service';
import { AgentOrchestrator } from '../agents/agent-orchestrator.service';
import type { OrchestratorResult } from '../agents/agent.types';

export type AiAnalysisResult = {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number;
  summary: string;
  thesis: string;
  risks: string[];
  catalysts: string[];
  keyLevels?: { support?: number; resistance?: number };
  mode: 'llm' | 'heuristic';
};

@Injectable()
export class AnalysisService {
  private readonly aiUrl: string;

  constructor(
    private readonly store: StoreService,
    private readonly orchestrator: AgentOrchestrator,
    private readonly riskEngine: RiskEngineService,
    private readonly config: ConfigService,
  ) {
    this.aiUrl = this.config.get<string>('AI_SERVICE_URL') || 'http://127.0.0.1:8001';
  }

  async analyze(coingeckoId: string, userId?: string, timeframe = '1d') {
    const { coin, desk, intel, riskReport } = await this.orchestrator.run(coingeckoId);
    const riskEngine = this.riskEngine.toAiJson(riskReport);
    const research = desk.agents.research;

    const payload = {
      coingecko_id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      timeframe,
      market: coin.market,
      categories: coin.categories,
      description: coin.description,
      risk_engine: riskEngine,
      holder_intelligence: {
        holders: intel.holders,
        top10Pct: intel.top10Pct,
        top20Pct: intel.top20Pct,
        smartMoneyOwnership: intel.smartMoneyOwnership,
        whaleOwnership: intel.whaleOwnership,
        creatorOwnership: intel.creatorOwnership,
        holderQualityScore: intel.holderQualityScore,
        alerts: intel.alerts,
      },
      agents: desk.agents,
      orchestrator: desk.graph,
    };

    let result: AiAnalysisResult;
    try {
      const res = await fetch(`${this.aiUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`AI service ${res.status}`);
      result = (await res.json()) as AiAnalysisResult;
    } catch {
      throw new HttpException(
        'AI service unavailable. Start apps/ai (port 8001).',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    result.score = research.score;
    result.sentiment = research.score >= 60 ? 'bullish' : research.score <= 40 ? 'bearish' : 'neutral';
    const lead =
      `Research Agent composite ${research.score}/100 (${result.sentiment}). ` +
      `Token ${desk.agents.token.score} · Wallet ${desk.agents.wallet.score} · Risk ${desk.agents.risk.score}. `;
    if (result.mode === 'heuristic') {
      const ch = coin.market.change24h;
      result.summary =
        `${lead}${coin.name} (${coin.symbol.toUpperCase()}) on ${timeframe}. ` +
        `Price ${coin.market.price} with 24h ${ch >= 0 ? '+' : ''}${Number(ch).toFixed(2)}%.`;
      result.thesis = research.findings.filter(Boolean).join(' ');
    } else {
      result.summary = lead + result.summary;
    }

    const report = await this.store.createAnalysis({
      userId: userId || null,
      coingeckoId: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      timeframe,
      sentiment: result.sentiment,
      score: result.score,
      summary: result.summary,
      thesis: result.thesis,
      risks: JSON.stringify(result.risks || []),
      catalysts: JSON.stringify(result.catalysts || []),
      rawJson: JSON.stringify({ ...result, riskEngine, riskReport, agents: desk }),
    });

    return {
      id: report.id,
      coin: {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        image: coin.image,
        price: coin.market.price,
        change24h: coin.market.change24h,
      },
      timeframe,
      analysis: result,
      riskEngine,
      riskReport,
      agents: desk,
      createdAt: report.createdAt,
    };
  }

  async desk(coingeckoId: string): Promise<OrchestratorResult> {
    const { desk } = await this.orchestrator.run(coingeckoId);
    return desk;
  }

  async recent(limit = 10, userId?: string) {
    const rows = await this.store.recentAnalyses(Math.min(limit, 50), userId);
    return rows.map((r) => ({
      id: r.id,
      coingeckoId: r.coingeckoId,
      symbol: r.symbol,
      name: r.name,
      sentiment: r.sentiment,
      score: r.score,
      summary: r.summary,
      createdAt: r.createdAt,
    }));
  }
}
