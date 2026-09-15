import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { WatchlistService } from './watchlist.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class AddWatchDto {
  @IsString()
  coingeckoId!: string;
}

@Controller('watchlist')
@UseGuards(JwtAuthGuard)
export class WatchlistController {
  constructor(private readonly watchlist: WatchlistService) {}

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.watchlist.list(req.user.userId);
  }

  @Post()
  add(@Req() req: { user: { userId: string } }, @Body() dto: AddWatchDto) {
    return this.watchlist.add(req.user.userId, dto.coingeckoId);
  }

  @Delete(':coingeckoId')
  remove(@Req() req: { user: { userId: string } }, @Param('coingeckoId') coingeckoId: string) {
    return this.watchlist.remove(req.user.userId, coingeckoId);
  }
}
