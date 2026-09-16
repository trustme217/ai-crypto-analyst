import { Controller, Get, Param, Query } from '@nestjs/common';
import { RiskEngineService } from './risk-engine.service';
import { HoldersService } from '../holders/holders.service';
import { MarketService } from '../market/market.service';

@Controller('risk')
export class RiskController {
  constructor(
    private readonly risk: RiskEngineService,
    private readonly holders: HoldersService,
    private readonly market: MarketService,
  ) {}

  @Get(':coingeckoId')
  async byId(
    @Param('coingeckoId') coingeckoId: string,
    @Query('symbol') symbol?: string,
  ) {
    let marketCap = 0;
    let volume24h = 0;
    let change24h = 0;
    let change7d: number | null = null;
    let categories: string[] = [];
    let sym = (symbol || coingeckoId).toUpperCase();
    try {
      const coin = await this.market.getCoin(coingeckoId);
      marketCap = coin.market?.marketCap ?? 0;
      volume24h = coin.market?.volume24h ?? 0;
      change24h = coin.market?.change24h ?? 0;
      change7d = coin.market?.change7d ?? null;
      categories = coin.categories || [];
      sym = (coin.symbol || sym).toUpperCase();
    } catch {
      /* estimate from holders + market proxies */
    }

    const intel = await this.holders.getIntelligence({
      coingeckoId,
      symbol: sym,
      marketCap,
      marketCapRank: null,
      volume24h,
    });

    const report = await this.risk.evaluate({
      coingeckoId,
      symbol: sym,
      marketCap,
      volume24h,
      change24h,
      change7d,
      categories,
      holderConcentration: intel.holderConcentration,
      creatorOwnership: intel.creatorOwnership,
    });

    return {
      ...report,
      aiJson: this.risk.toAiJson(report),
    };
  }
}
