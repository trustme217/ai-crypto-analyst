import { Injectable, Logger } from '@nestjs/common';
import { StoreService } from '../store/store.service';
import { MarketService } from '../market/market.service';
import { SmartMoneyService } from '../smart-money/smart-money.service';
import { HoldersService } from '../holders/holders.service';
import { RiskEngineService } from '../risk/risk-engine.service';
import { TokenScoreService } from '../scoring/token-score.service';
import { BacktestService } from '../backtest/backtest.service';
import { StrategyService } from '../strategy/strategy.service';
import { formatSignalMessage, signalTitle } from './signal-format';
import type { SignalDraft, SignalPayload, SignalType } from './signal.types';

@Injectable()
export class SignalDetectorService {
  private readonly logger = new Logger(SignalDetectorService.name);

  constructor(
    private readonly store: StoreService,
    private readonly market: MarketService,
    private readonly smart: SmartMoneyService,
    private readonly holders: HoldersService,
    private readonly risk: RiskEngineService,
    private readonly tokenScore: TokenScoreService,
    private readonly backtest: BacktestService,
    private readonly strategies: StrategyService,
  ) {}

  async scan(): Promise<number> {
    let emitted = 0;
    try {
      emitted += await this.scanSmartMoney();
    } catch (err) {
      this.logger.warn(`SMART_MONEY_BUY scan: ${(err as Error).message}`);
    }
    try {
      emitted += await this.scanAi();
    } catch (err) {
      this.logger.warn(`AI_SIGNAL scan: ${(err as Error).message}`);
    }
    try {
      emitted += await this.scanMetrics();
    } catch (err) {
      this.logger.warn(`metric scan: ${(err as Error).message}`);
    }
    return emitted;
  }

  async emitPriceLevel(input: {
    alertId: string;
    coingeckoId: string;
    symbol: string;
    name: string;
    direction: string;
    targetPrice: number;
    price: number;
  }) {
    const analysis = await this.store.latestAnalysisFor(input.coingeckoId);
    return this.emit(
      {
        type: 'PRICE',
        coingeckoId: input.coingeckoId,
        symbol: input.symbol,
        name: input.name,
        fingerprint: `PRICE:${input.alertId}`,
        payload: {
          direction: input.direction,
          targetPrice: input.targetPrice,
          price: input.price,
          aiSummary: analysis?.summary,
        },
      },
      false,
    );
  }

  private hourBucket() {
    return Math.floor(Date.now() / 3_600_000);
  }

  private async emit(draft: SignalDraft, fanout = true): Promise<boolean> {
    const title = signalTitle(draft.type);
    const body = formatSignalMessage(draft.type, draft.symbol, draft.name, draft.payload);
    const row = await this.store.recordSignal({
      type: draft.type,
      coingeckoId: draft.coingeckoId,
      symbol: draft.symbol.toUpperCase(),
      name: draft.name,
      title,
      body,
      payloadJson: JSON.stringify(draft.payload),
      fingerprint: draft.fingerprint,
      fanout,
    });
    return Boolean(row);
  }

  private async scanSmartMoney(): Promise<number> {
    const { signals } = await this.smart.recentSignals(60);
    let n = 0;
    const since = new Date(Date.now() - 60 * 60_000);
    for (const sig of signals) {
      if (sig.wallets.length < 2) continue;
      const id = sig.coingeckoId || sig.symbol.toLowerCase();
      const walletKey = sig.wallets
        .map((w) => w.address)
        .sort()
        .join(',');
      let volume24h: number | undefined;
      let liquidityScore: number | undefined;
      let riskScore: number | undefined;
      let name = sig.symbol;
      try {
        if (sig.coingeckoId) {
          const coin = await this.market.getCoin(sig.coingeckoId);
          name = coin.name;
          volume24h = coin.market.volume24h;
          const hold = await this.holders.getIntelligence({
            coingeckoId: coin.id,
            symbol: coin.symbol,
            marketCap: coin.market.marketCap,
            marketCapRank: null,
            volume24h: coin.market.volume24h,
          });
          const risk = await this.risk.evaluate({
            coingeckoId: coin.id,
            symbol: coin.symbol,
            marketCap: coin.market.marketCap,
            volume24h: coin.market.volume24h,
            change24h: coin.market.change24h,
            change7d: coin.market.change7d,
            holderConcentration: hold.holderConcentration,
            creatorOwnership: hold.creatorOwnership,
          });
          liquidityScore = risk.liquidityScore;
          riskScore = risk.riskScore;
        }
      } catch (err) {
        this.logger.warn(`SMART_MONEY enrich ${sig.symbol}: ${(err as Error).message}`);
      }
      const analysis = sig.coingeckoId ? await this.store.latestAnalysisFor(sig.coingeckoId) : null;
      const combinedUsd = await this.store.combinedBuyNotional(sig.symbol, since);
      const ok = await this.emit({
        type: 'SMART_MONEY_BUY',
        coingeckoId: id,
        symbol: sig.symbol,
        name,
        fingerprint: `SMART_MONEY_BUY:${sig.symbol}:${walletKey}:${this.hourBucket()}`,
        payload: {
          smartMoneyScore: sig.score,
          walletCount: sig.wallets.length,
          combinedUsd,
          wallets: sig.wallets.map((w) => ({
            label: w.label || w.address.slice(0, 6),
            pnl: w.totalPnL,
          })),
          volume24h,
          liquidityScore,
          riskScore,
          aiSummary: analysis?.summary,
        },
      });
      if (ok) n += 1;
    }
    return n;
  }

  private async scanAi(): Promise<number> {
    const rows = await this.store.recentAnalysesSince(new Date(Date.now() - 10 * 60_000), 20);
    let n = 0;
    for (const r of rows) {
      const ok = await this.emit({
        type: 'AI_SIGNAL',
        coingeckoId: r.coingeckoId,
        symbol: r.symbol,
        name: r.name,
        fingerprint: `AI_SIGNAL:${r.coingeckoId}:${this.hourBucket()}`,
        payload: {
          tokenScore: r.score,
          aiSummary: r.summary,
        },
      });
      if (ok) n += 1;
    }
    return n;
  }

  private async universe(): Promise<Array<{ coingeckoId: string; symbol: string; name: string }>> {
    const map = new Map<string, { coingeckoId: string; symbol: string; name: string }>();
    const add = (coingeckoId: string, symbol: string, name: string) => {
      if (!coingeckoId || map.has(coingeckoId)) return;
      map.set(coingeckoId, { coingeckoId, symbol, name });
    };
    for (const w of await this.store.listWatchlistUniverse(8)) {
      add(w.coingeckoId, w.symbol, w.name);
    }
    for (const a of await this.store.listActiveAlerts()) {
      add(a.coingeckoId, a.symbol, a.name);
    }
    const sm = await this.smart.recentSignals(60);
    for (const s of sm.signals) {
      if (s.coingeckoId) add(s.coingeckoId, s.symbol, s.symbol);
    }
    return [...map.values()].slice(0, 8);
  }

  private async scanMetrics(): Promise<number> {
    const coins = await this.universe();
    let n = 0;
    for (const row of coins) {
      try {
        n += await this.diffCoin(row);
      } catch (err) {
        this.logger.warn(`metrics ${row.coingeckoId}: ${(err as Error).message}`);
      }
    }
    return n;
  }

  private async diffCoin(row: { coingeckoId: string; symbol: string; name: string }): Promise<number> {
    const coin = await this.market.getCoin(row.coingeckoId);
    const sm = await this.smart.scoreForSymbol(coin.symbol, 60);
    const hold = await this.holders.getIntelligence({
      coingeckoId: coin.id,
      symbol: coin.symbol,
      marketCap: coin.market.marketCap,
      marketCapRank: null,
      volume24h: coin.market.volume24h,
    });
    const risk = await this.risk.evaluate({
      coingeckoId: coin.id,
      symbol: coin.symbol,
      marketCap: coin.market.marketCap,
      volume24h: coin.market.volume24h,
      change24h: coin.market.change24h,
      change7d: coin.market.change7d,
      holderConcentration: hold.holderConcentration,
      creatorOwnership: hold.creatorOwnership,
    });
    const scores = this.tokenScore.score({
      symbol: coin.symbol,
      price: coin.market.price,
      marketCap: coin.market.marketCap,
      volume24h: coin.market.volume24h,
      change24h: coin.market.change24h,
      change7d: coin.market.change7d,
      marketCapRank: null,
      smartMoneyScore: sm,
      holderQualityScore: hold.holderQualityScore,
      riskScore: risk.riskScore,
    });
    await this.backtest.observe({
      coingeckoId: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      score: scores.score,
      price: coin.market.price,
      source: 'token-score',
    });
    await this.backtest.writePrice({
      coingeckoId: coin.id,
      symbol: coin.symbol,
      price: coin.market.price,
      volume24h: coin.market.volume24h,
      marketCap: coin.market.marketCap,
    });
    const analysis = await this.store.latestAnalysisFor(coin.id);
    await this.strategies.consider({
      coingeckoId: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      price: coin.market.price,
      tokenScore: scores.score,
      smartMoneyScore: sm ?? scores.smartMoney,
      liquidityScore: scores.liquidity,
      liquidity: coin.market.volume24h,
      volume24h: coin.market.volume24h,
      marketCap: coin.market.marketCap,
      momentum: scores.momentum,
      holderQuality: scores.holderQuality,
      riskScore: risk.riskScore,
      sellPressure: risk.sellPressure,
      aiScore: analysis?.score,
    });

    const prev = await this.store.lastMetricSnapshot(coin.id);
    const snaps = await this.store.lastHolderSnapshots(coin.id, 2);
    let n = 0;

    const base = {
      coingeckoId: coin.id,
      symbol: coin.symbol,
      name: coin.name,
    };

    if (prev) {
      const pricePct = prev.price > 0 ? ((coin.market.price - prev.price) / prev.price) * 100 : 0;
      const common: SignalPayload = {
        price: coin.market.price,
        volume24h: coin.market.volume24h,
        marketCap: coin.market.marketCap,
        liquidityScore: risk.liquidityScore,
        riskScore: risk.riskScore,
        tokenScore: scores.score,
        aiSummary: analysis?.summary,
      };

      const maybe = async (type: SignalType, hit: boolean, fingerprint: string, extra: SignalPayload) => {
        if (!hit) return;
        const ok = await this.emit({
          type,
          ...base,
          fingerprint,
          payload: { ...common, ...extra },
        });
        if (ok) n += 1;
      };

      await maybe(
        'TOKEN_SCORE_CHANGE',
        Math.abs(scores.score - prev.tokenScore) >= 5,
        `TOKEN_SCORE_CHANGE:${coin.id}:${Math.round(scores.score)}:${this.hourBucket()}`,
        { prevTokenScore: prev.tokenScore, tokenScore: scores.score },
      );
      await maybe(
        'RISK_CHANGE',
        Math.abs(risk.riskScore - prev.riskScore) >= 8,
        `RISK_CHANGE:${coin.id}:${risk.riskScore}:${this.hourBucket()}`,
        { prevRisk: prev.riskScore, riskScore: risk.riskScore },
      );
      await maybe(
        'LIQUIDITY_DROP',
        prev.liquidityScore - risk.liquidityScore >= 12,
        `LIQUIDITY_DROP:${coin.id}:${risk.liquidityScore}:${this.hourBucket()}`,
        { prevLiquidity: prev.liquidityScore, liquidityScore: risk.liquidityScore },
      );
      await maybe(
        'VOLUME',
        prev.volume24h > 0 && coin.market.volume24h >= prev.volume24h * 1.8,
        `VOLUME:${coin.id}:${this.hourBucket()}`,
        { prevVolume: prev.volume24h, volume24h: coin.market.volume24h },
      );
      await maybe(
        'PRICE',
        Math.abs(pricePct) >= 6,
        `PRICE_MOVE:${coin.id}:${pricePct >= 0 ? 'up' : 'down'}:${this.hourBucket()}`,
        { prevPrice: prev.price, price: coin.market.price, changePct: pricePct },
      );
    }

    if (snaps.length >= 2) {
      const [now, before] = snaps;
      const whaleDelta = now.whaleOwnership - before.whaleOwnership;
      if (whaleDelta >= 4) {
        const ok = await this.emit({
          type: 'WHALE_ACTIVITY',
          ...base,
          fingerprint: `WHALE_ACTIVITY:${coin.id}:${before.whaleOwnership}:${now.whaleOwnership}`,
          payload: {
            whaleOwnership: now.whaleOwnership,
            prevWhale: before.whaleOwnership,
            volume24h: coin.market.volume24h,
            liquidityScore: risk.liquidityScore,
            riskScore: risk.riskScore,
            aiSummary: analysis?.summary,
          },
        });
        if (ok) n += 1;
      }
    }

    const stale =
      !prev || Date.now() - prev.capturedAt.getTime() > 10 * 60_000 || n > 0;
    if (stale) {
      await this.store.saveMetricSnapshot({
        coingeckoId: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.market.price,
        volume24h: coin.market.volume24h,
        marketCap: coin.market.marketCap,
        tokenScore: scores.score,
        riskScore: risk.riskScore,
        liquidityScore: risk.liquidityScore,
        whaleOwnership: hold.whaleOwnership,
      });
    }

    return n;
  }
}
