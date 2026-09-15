import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { AnalysisService } from './analysis.service';
import { OptionalJwtAuthGuard } from '../auth/jwt-auth.guard';

class AnalyzeDto {
  @IsString()
  coingeckoId!: string;

  @IsOptional()
  @IsString()
  timeframe?: string;
}

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  analyze(@Body() dto: AnalyzeDto, @Req() req: { user?: { userId: string } }) {
    return this.analysis.analyze(dto.coingeckoId, req.user?.userId, dto.timeframe || '1d');
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('recent')
  recent(@Query('limit') limit?: string, @Req() req?: { user?: { userId: string } }) {
    return this.analysis.recent(limit ? Number(limit) : 10, req?.user?.userId);
  }
}
