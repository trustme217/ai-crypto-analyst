import { Module } from '@nestjs/common';
import { SmartMoneyService } from './smart-money.service';
import { SmartMoneyController } from './smart-money.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SmartMoneyController],
  providers: [SmartMoneyService],
  exports: [SmartMoneyService],
})
export class SmartMoneyModule {}
