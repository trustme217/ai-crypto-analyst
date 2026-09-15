import { Module } from '@nestjs/common';
import { TokenScoreService } from './token-score.service';

@Module({
  providers: [TokenScoreService],
  exports: [TokenScoreService],
})
export class ScoringModule {}
