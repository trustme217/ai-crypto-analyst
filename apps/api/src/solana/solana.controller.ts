import { Controller, Get, Query } from '@nestjs/common';
import { SolanaService } from './solana.service';

@Controller('solana')
export class SolanaController {
  constructor(private readonly solana: SolanaService) {}

  @Get('wallet')
  wallet(@Query('address') address = '') {
    return this.solana.lookup(address.trim());
  }
}
