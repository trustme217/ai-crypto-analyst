import { Module } from '@nestjs/common';
import { SmartMoneyService } from './smart-money.service';
import { SmartMoneyController } from './smart-money.controller';
import { WalletIngestService } from './wallet-ingest.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SolanaModule } from '../solana/solana.module';

@Module({
  imports: [PrismaModule, SolanaModule],
  controllers: [SmartMoneyController],
  providers: [SmartMoneyService, WalletIngestService],
  exports: [SmartMoneyService, WalletIngestService],
})
export class SmartMoneyModule {}
