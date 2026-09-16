import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsNumber, IsString, Min } from 'class-validator';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimitGuard } from '../common/rate-limit.guard';

class CreateAlertDto {
  @IsString()
  coingeckoId!: string;

  @IsIn(['above', 'below'])
  direction!: 'above' | 'below';

  @IsNumber()
  @Min(0)
  targetPrice!: number;
}

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get('types')
  types() {
    return this.alerts.types();
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('signals')
  signals() {
    return this.alerts.recentSignals();
  }

  @UseGuards(OptionalJwtAuthGuard, RateLimitGuard(8, 60_000))
  @Post('scan')
  scan() {
    return this.alerts.scan();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.alerts.list(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: { user: { userId: string } }, @Body() dto: CreateAlertDto) {
    return this.alerts.create(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.alerts.remove(req.user.userId, id);
  }
}
