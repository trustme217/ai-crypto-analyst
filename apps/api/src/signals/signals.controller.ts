import { Controller, Get, Query } from '@nestjs/common';
import { SignalsService } from './signals.service';

@Controller('signals')
export class SignalsController {
  constructor(private readonly signals: SignalsService) {}

  @Get()
  list(@Query('style') style?: string) {
    const allowed = ['conservative', 'balanced', 'aggressive'] as const;
    const s = allowed.includes(style as (typeof allowed)[number])
      ? (style as (typeof allowed)[number])
      : 'balanced';
    return this.signals.list(s);
  }
}
