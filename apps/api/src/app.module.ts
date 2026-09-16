import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StoreModule } from './store/store.module';
import { AuthModule } from './auth/auth.module';
import { MarketModule } from './market/market.module';
import { AnalysisModule } from './analysis/analysis.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { SolanaModule } from './solana/solana.module';
import { ChatModule } from './chat/chat.module';
import { SignalsModule } from './signals/signals.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { AlertsModule } from './alerts/alerts.module';
import { SettingsModule } from './settings/settings.module';
import { CopyTradingModule } from './copy-trading/copy-trading.module';
import { SmartMoneyModule } from './smart-money/smart-money.module';
import { HoldersModule } from './holders/holders.module';
import { RiskModule } from './risk/risk.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Prefer monorepo root .env (TELEGRAM_BOT_TOKEN, JWT, etc.), then apps/api/.env
      envFilePath: ['../../.env', '.env'],
    }),
    StoreModule,
    AuthModule,
    MarketModule,
    AnalysisModule,
    WatchlistModule,
    SolanaModule,
    ChatModule,
    SignalsModule,
    PortfolioModule,
    AlertsModule,
    SettingsModule,
    CopyTradingModule,
    SmartMoneyModule,
    HoldersModule,
    RiskModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
