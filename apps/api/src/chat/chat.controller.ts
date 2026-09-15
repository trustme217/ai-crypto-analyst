import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { ChatService } from './chat.service';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/jwt-auth.guard';

class ChatDto {
  @IsString()
  @MinLength(1)
  message!: string;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  ask(@Body() dto: ChatDto, @Req() req: { user?: { userId: string } }) {
    return this.chat.ask(dto.message, req.user?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  history(@Req() req: { user: { userId: string } }) {
    return this.chat.history(req.user.userId);
  }
}
