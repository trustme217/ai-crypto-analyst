import { Injectable } from '@nestjs/common';
import { MarketService } from '../market/market.service';
import { TokenScoreService, type TokenScoreBreakdown } from '../scoring/token-score.service';
import { SmartMoneyService } from '../smart-money/smart-money.service';
import { HoldersService } from '../holders/holders.service';
import { RiskEngineService, type TokenRiskReport } from '../risk/risk-engine.service';

export type TradingSignal = {
  id: string;
  coingeckoId: string;
  symbol: string;
  name: string;
  image: string;
  side: 'long' | 'short' | 'neutral';
  confidence: number;
  timeframe: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  rationale: string;
  change24h: number;
  change7d?: number | null;
  volMcap?: number;
  scores: TokenScoreBreakdown;
  holderAlerts?: Array<{ title: string; risk: string; detail: string }>;
  riskEngine?: TokenRiskReport;
  generatedAt: string;
};

type MarketRow = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number | null;
  total_volume: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency?: number | null;
};

@Injectable()
export class SignalsService {
  constructor(
    private readonly market: MarketService,
    private readonly tokenScore: TokenScoreService,
    private readonly smartMoney: SmartMoneyService,
    private readonly holders: HoldersService,
    private readonly riskEngine: RiskEngineService,
  ) {}

  async list(style: 'conservative' | 'balanced' | 'aggressive' = 'balanced'): Promise<{
    style: string;
    source: 'token-score';
    weights: {
      smartMoney: number;
      liquidity: number;
      volume: number;
      momentum: number;
      holderQuality: number;
      risk: number;
    };
    disclaimer: string;
    signals: TradingSignal[];
  }> {
    const overview = await this.market.getOverview(24);
    const confFloor = style === 'conservative' ? 62 : style === 'aggressive' ? 48 : 55;

    const signals: TradingSignal[] = [];
    for (const c of overview.coins as MarketRow[]) {
      const change = c.price_change_percentage_24h ?? 0;
      const change7d = c.price_change_percentage_7d_in_currency ?? null;
      const price = c.current_price;
      const volMcap = c.market_cap > 0 ? c.total_volume / c.market_cap : 0;

      const sm = await this.smartMoney.scoreForSymbol(c.symbol.toUpperCase(), 60);
      const hold = await this.holders.getIntelligence({
        coingeckoId: c.id,
        symbol: c.symbol,
        marketCap: c.market_cap,
        marketCapRank: c.market_cap_rank,
        volume24h: c.total_volume,
      });
      const risk = await this.riskEngine.evaluate({
        coingeckoId: c.id,
        symbol: c.symbol,
        marketCap: c.market_cap,
        volume24h: c.total_volume,
        change24h: change,
        change7d,
        holderConcentration: hold.holderConcentration,
        creatorOwnership: hold.creatorOwnership,
      });
      const scores = this.tokenScore.score({
        symbol: c.symbol,
        price,
        marketCap: c.market_cap,
        volume24h: c.total_volume,
        change24h: change,
        change7d,
        marketCapRank: c.market_cap_rank,
        smartMoneyScore: sm,
        holderQualityScore: hold.holderQualityScore,
        riskScore: risk.riskScore,
      });

      let side: TradingSignal['side'] = 'neutral';
      if (scores.score >= 62 && scores.momentum >= 55 && scores.risk < 70) side = 'long';
      else if (scores.score <= 42 || (scores.momentum <= 40 && scores.risk >= 55)) side = 'short';

      let confidence = Math.round(scores.score);
      if (style === 'conservative' && confidence < confFloor) side = 'neutral';
      if (style === 'aggressive' && side === 'neutral' && scores.score >= 55 && scores.momentum >= 52) {
        side = 'long';
        confidence = Math.max(confidence, 55);
      }
      if (style === 'aggressive' && side === 'neutral' && scores.score <= 48 && scores.momentum <= 48) {
        side = 'short';
        confidence = Math.max(confidence, 52);
      }

      const buffer = style === 'aggressive' ? 0.035 : style === 'conservative' ? 0.02 : 0.025;
      const entry = price;
      const stopLoss = side === 'long' ? price * (1 - buffer) : side === 'short' ? price * (1 + buffer) : price;
      const takeProfit =
        side === 'long' ? price * (1 + buffer * 2.2) : side === 'short' ? price * (1 - buffer * 2.2) : price;

      const rationale =
        `Token score ${scores.score}/100 (SM ${scores.smartMoney}, Liq ${scores.liquidity}, Vol ${scores.volume}, ` +
        `Mom ${scores.momentum}, Hold ${scores.holderQuality}, Risk ${scores.risk}). ` +
        `Top10 ${hold.top10Pct}%. Deterministic — not LLM. Research only.`;

      signals.push({
        id: `${c.id}-${side}-${scores.score}`,
        coingeckoId: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        image: c.image,
        side,
        confidence,
        timeframe: '1d',
        entry,
        stopLoss,
        takeProfit,
        rationale,
        change24h: change,
        change7d,
        volMcap,
        scores,
        holderAlerts: hold.alerts.map((a) => ({
          title: a.title,
          risk: a.risk,
          detail: a.detail,
        })),
        riskEngine: risk,
        generatedAt: new Date().toISOString(),
      });
    }

    signals.sort((a, b) => b.scores.score - a.scores.score);

    return {
      style,
      source: 'token-score',
      weights: {
        smartMoney: 30,
        liquidity: 15,
        volume: 15,
        momentum: 15,
        holderQuality: 15,
        risk: 10,
      },
      disclaimer:
        'Token Score is deterministic (smart money / liquidity / volume / momentum / holders / risk). AI does not invent these numbers — research only, not advice.',
      signals,
    };
  }
}
