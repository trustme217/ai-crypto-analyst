import { Module } from '@nestjs/common';
import { HoldersService } from './holders.service';
import { HoldersController } from './holders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [PrismaModule, MarketModule],
  controllers: [HoldersController],
  providers: [HoldersService],
  exports: [HoldersService],
})
export class HoldersModule {}
