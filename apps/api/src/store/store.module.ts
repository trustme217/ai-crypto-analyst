import { Global, Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}
