import { Controller, Get, Param, Query } from '@nestjs/common';
import { HoldersService } from './holders.service';
import { MarketService } from '../market/market.service';

@Controller('holders')
export class HoldersController {
  constructor(
    private readonly holders: HoldersService,
    private readonly market: MarketService,
  ) {}

  @Get(':coingeckoId')
  async byId(
    @Param('coingeckoId') coingeckoId: string,
    @Query('symbol') symbol?: string,
  ) {
    let marketCap = 0;
    let marketCapRank: number | null = null;
    let sym = (symbol || coingeckoId).toUpperCase();
    let volume24h = 0;
    try {
      const coin = await this.market.getCoin(coingeckoId);
      marketCap = coin.market?.marketCap ?? 0;
      volume24h = coin.market?.volume24h ?? 0;
      sym = (coin.symbol || sym).toUpperCase();
      // rank not always on detail — leave null; estimate handles it
    } catch {
      // still return estimate from id/symbol
    }
    return this.holders.getIntelligence({
      coingeckoId,
      symbol: sym,
      marketCap,
      marketCapRank,
      volume24h,
    });
  }
}
