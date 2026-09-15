import { Controller, Get, Param, Query } from '@nestjs/common';
import { MarketService } from './market.service';

@Controller('market')
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get('overview')
  overview(@Query('limit') limit?: string) {
    return this.market.getOverview(limit ? Number(limit) : 20);
  }

  @Get('search')
  search(@Query('q') q = '') {
    return this.market.search(q);
  }

  @Get('coins/:id')
  coin(@Param('id') id: string) {
    return this.market.getCoin(id);
  }
}
