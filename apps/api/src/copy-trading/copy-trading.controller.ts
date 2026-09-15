import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsNumber, IsString, Max, Min } from 'class-validator';
import { CopyTradingService } from './copy-trading.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class FollowDto {
  @IsString()
  traderId!: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  allocationPct!: number;
}

@Controller('copy-trading')
export class CopyTradingController {
  constructor(private readonly copy: CopyTradingService) {}

  @Get('leaders')
  leaders() {
    return this.copy.leaders();
  }

  @UseGuards(JwtAuthGuard)
  @Get('follows')
  follows(@Req() req: { user: { userId: string } }) {
    return this.copy.myFollows(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('follow')
  follow(@Req() req: { user: { userId: string } }, @Body() dto: FollowDto) {
    return this.copy.follow(req.user.userId, dto.traderId, dto.allocationPct);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('follow/:traderId')
  unfollow(@Req() req: { user: { userId: string } }, @Param('traderId') traderId: string) {
    return this.copy.unfollow(req.user.userId, traderId);
  }
}
