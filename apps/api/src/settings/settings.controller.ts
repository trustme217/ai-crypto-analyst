import { Body, Controller, Delete, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  defaultTimeframe?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  riskTolerance?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsBoolean()
  emailAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  telegramAlerts?: boolean;

  @IsOptional()
  @IsString()
  telegramChatId?: string | null;

  @IsOptional()
  @IsIn(['conservative', 'balanced', 'aggressive'])
  signalStyle?: 'conservative' | 'balanced' | 'aggressive';

  @IsOptional()
  @IsIn([
    'USD',
    'EUR',
    'GBP',
    'JPY',
    'KRW',
    'CNY',
    'HKD',
    'SGD',
    'AUD',
    'CAD',
    'CHF',
    'INR',
    'BRL',
    'TRY',
    'AED',
    'BTC',
    'ETH',
  ])
  currency?: string;
}

class TelegramTestDto {
  @IsOptional()
  @IsString()
  chatId?: string;
}

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@Req() req: { user: { userId: string } }) {
    return this.settings.get(req.user.userId);
  }

  @Patch()
  update(@Req() req: { user: { userId: string } }, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(req.user.userId, dto);
  }

  @Post('telegram/test')
  testTelegram(@Req() req: { user: { userId: string } }, @Body() dto: TelegramTestDto) {
    return this.settings.testTelegram(req.user.userId, dto.chatId);
  }

  @Delete('telegram')
  disconnectTelegram(@Req() req: { user: { userId: string } }) {
    return this.settings.disconnectTelegram(req.user.userId);
  }

  @Get('telegram/chats')
  recentChats() {
    return this.settings.recentTelegramChats();
  }
}
