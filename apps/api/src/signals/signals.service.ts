import { Injectable } from '@nestjs/common';
import { MarketService } from '../market/market.service';

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
  generatedAt: string;
};

type MarketRow = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency?: number | null;
};

@Injectable()
export class SignalsService {
  constructor(private readonly market: MarketService) {}

  async list(style: 'conservative' | 'balanced' | 'aggressive' = 'balanced'): Promise<{
    style: string;
    source: 'heuristic';
    disclaimer: string;
    signals: TradingSignal[];
  }> {
    const overview = await this.market.getOverview(24);
    const confFloor = style === 'conservative' ? 62 : style === 'aggressive' ? 48 : 55;

    const signals: TradingSignal[] = (overview.coins as MarketRow[]).map((c) => {
      const change = c.price_change_percentage_24h ?? 0;
      const change7d = c.price_change_percentage_7d_in_currency ?? null;
      const price = c.current_price;
      const volMcap = c.market_cap > 0 ? c.total_volume / c.market_cap : 0;

      let side: TradingSignal['side'] = 'neutral';
      let confidence = 50;

      // Blend 24h momentum with 7d trend and liquidity
      const trend7 = change7d ?? 0;
      const momentum = change * 0.65 + (trend7 / 3) * 0.35;
      const liqBoost = volMcap > 0.12 ? 8 : volMcap > 0.05 ? 3 : -4;

      if (momentum >= 2.2) {
        side = 'long';
        confidence = Math.min(92, 52 + momentum * 2.5 + liqBoost);
      } else if (momentum <= -2.2) {
        side = 'short';
        confidence = Math.min(92, 52 + Math.abs(momentum) * 2.5 + liqBoost);
      } else {
        confidence = Math.max(35, 48 + Math.abs(momentum) + liqBoost * 0.5);
      }

      if (style === 'conservative' && confidence < confFloor) side = 'neutral';
      if (style === 'aggressive' && Math.abs(momentum) >= 1.0 && side === 'neutral') {
        side = momentum > 0 ? 'long' : 'short';
        confidence = Math.max(confidence, 52);
      }
      if (volMcap < 0.02 && style !== 'aggressive') {
        side = 'neutral';
        confidence = Math.min(confidence, 50);
      }

      const buffer = style === 'aggressive' ? 0.035 : style === 'conservative' ? 0.02 : 0.025;
      const entry = price;
      const stopLoss = side === 'long' ? price * (1 - buffer) : side === 'short' ? price * (1 + buffer) : price;
      const takeProfit =
        side === 'long' ? price * (1 + buffer * 2.2) : side === 'short' ? price * (1 - buffer * 2.2) : price;

      const volPct = (volMcap * 100).toFixed(1);
      const c7 = change7d != null ? `, 7d ${change7d.toFixed(2)}%` : '';
      const rationale =
        side === 'neutral'
          ? `${c.symbol.toUpperCase()} mixed (${change.toFixed(2)}% 24h${c7}; vol/mcap ${volPct}%). Wait for a clearer break.`
          : `${c.symbol.toUpperCase()} ${side} heuristic: ${change.toFixed(2)}% 24h${c7}, vol/mcap ${volPct}%. Style=${style}. Research only.`;

      return {
        id: `${c.id}-${side}`,
        coingeckoId: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        image: c.image,
        side,
        confidence: Math.round(confidence),
        timeframe: '1d',
        entry,
        stopLoss,
        takeProfit,
        rationale,
        change24h: change,
        change7d,
        volMcap,
        generatedAt: new Date().toISOString(),
      };
    });

    signals.sort((a, b) => b.confidence - a.confidence);

    return {
      style,
      source: 'heuristic',
      disclaimer:
        'Heuristic rankings from 24h/7d momentum and volume/mcap — not an AI model and not financial advice.',
      signals,
    };
  }
}
