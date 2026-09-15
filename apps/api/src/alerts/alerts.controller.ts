import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsNumber, IsString, Min } from 'class-validator';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.alerts.list(req.user.userId);
  }

  @Post()
  create(@Req() req: { user: { userId: string } }, @Body() dto: CreateAlertDto) {
    return this.alerts.create(req.user.userId, dto);
  }

  @Delete(':id')
  remove(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.alerts.remove(req.user.userId, id);
  }
}
