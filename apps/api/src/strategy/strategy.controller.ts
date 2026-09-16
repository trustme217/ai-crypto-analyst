import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { StrategyService } from './strategy.service';
import { OptionalJwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimitGuard } from '../common/rate-limit.guard';
import type { StrategyConditions } from './strategy.types';

class CreateStrategyDto {
  @IsString()
  name!: string;

  @IsObject()
  conditions!: StrategyConditions;

  @IsOptional()
  @IsString()
  side?: 'long' | 'short';

  @IsOptional()
  @IsNumber()
  maxRiskScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  notionalUsd?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@Controller('strategies')
export class StrategyController {
  constructor(private readonly strategies: StrategyService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list() {
    return this.strategies.list();
  }

  @UseGuards(OptionalJwtAuthGuard, RateLimitGuard(20, 60_000))
  @Post()
  create(@Body() dto: CreateStrategyDto) {
    return this.strategies.create(dto);
  }

  @UseGuards(OptionalJwtAuthGuard, RateLimitGuard(8, 60_000))
  @Post('run')
  run() {
    return this.strategies.runLatest();
  }
}
