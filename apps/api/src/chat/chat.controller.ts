import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { ChatService } from './chat.service';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimitGuard } from '../common/rate-limit.guard';

class ChatDto {
  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

class CreateSessionDto {
  @IsOptional()
  @IsString()
  title?: string;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @UseGuards(OptionalJwtAuthGuard, RateLimitGuard(40, 60_000))
  @Post()
  ask(@Body() dto: ChatDto, @Req() req: { user?: { userId: string } }) {
    return this.chat.ask(dto.message, req.user?.userId, dto.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  history(@Req() req: { user: { userId: string } }, @Query('limit') limit?: string) {
    return this.chat.history(req.user.userId, limit ? Number(limit) : 40);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  sessions(@Req() req: { user: { userId: string } }) {
    return this.chat.listSessions(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions')
  createSession(@Req() req: { user: { userId: string } }, @Body() dto: CreateSessionDto) {
    return this.chat.createSession(req.user.userId, dto.title);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions/:id')
  session(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.chat.sessionMessages(req.user.userId, id);
  }
}
