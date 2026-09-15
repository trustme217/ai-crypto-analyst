import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsNumber, IsString, Min } from 'class-validator';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class AddPositionDto {
  @IsString()
  coingeckoId!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0)
  avgCostUsd!: number;
}

@Controller('portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.portfolio.list(req.user.userId);
  }

  @Post()
  add(@Req() req: { user: { userId: string } }, @Body() dto: AddPositionDto) {
    return this.portfolio.add(req.user.userId, dto);
  }

  @Delete(':id')
  remove(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.portfolio.remove(req.user.userId, id);
  }
}
