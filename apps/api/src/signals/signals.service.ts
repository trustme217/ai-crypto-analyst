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
  generatedAt: string;
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
    const overview = await this.market.getOverview(12);
    const confFloor = style === 'conservative' ? 62 : style === 'aggressive' ? 48 : 55;

    const signals: TradingSignal[] = overview.coins.map((c) => {
      const change = c.price_change_percentage_24h ?? 0;
      const price = c.current_price;
      let side: TradingSignal['side'] = 'neutral';
      let confidence = 50;

      if (change >= 2.5) {
        side = 'long';
        confidence = Math.min(92, 55 + change * 3);
      } else if (change <= -2.5) {
        side = 'short';
        confidence = Math.min(92, 55 + Math.abs(change) * 3);
      } else {
        confidence = 45 + Math.abs(change) * 2;
      }

      if (style === 'conservative' && confidence < confFloor) side = 'neutral';
      if (style === 'aggressive' && Math.abs(change) >= 1.2 && side === 'neutral') {
        side = change > 0 ? 'long' : 'short';
        confidence = Math.max(confidence, 52);
      }

      const buffer = style === 'aggressive' ? 0.035 : style === 'conservative' ? 0.02 : 0.025;
      const entry = price;
      const stopLoss = side === 'long' ? price * (1 - buffer) : side === 'short' ? price * (1 + buffer) : price;
      const takeProfit =
        side === 'long' ? price * (1 + buffer * 2.2) : side === 'short' ? price * (1 - buffer * 2.2) : price;

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
        rationale:
          side === 'neutral'
            ? `${c.symbol.toUpperCase()} is range-bound (${change.toFixed(2)}% 24h). Wait for a clearer break.`
            : `${c.symbol.toUpperCase()} shows ${side === 'long' ? 'upside' : 'downside'} momentum at ${change.toFixed(2)}% 24h. Heuristic ${style} signal — research only, not advice.`,
        change24h: change,
        generatedAt: new Date().toISOString(),
      };
    });

    signals.sort((a, b) => b.confidence - a.confidence);

    return {
      style,
      source: 'heuristic',
      disclaimer:
        'Heuristic momentum rankings from 24h price change — not an AI model and not financial advice. No orders are placed.',
      signals,
    };
  }
}
