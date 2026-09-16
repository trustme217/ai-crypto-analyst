import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

function redisConnection(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || '127.0.0.1',
      port: Number(u.port || 6379),
      password: u.password || undefined,
      maxRetriesPerRequest: null as null,
    };
  } catch {
    return { host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null as null };
  }
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnection(config.get<string>('REDIS_URL') || 'redis://127.0.0.1:6379'),
      }),
    }),
    BullModule.registerQueue(
      { name: 'blockchain' },
      { name: 'scoring' },
      { name: 'ai' },
      { name: 'alerts' },
    ),
  ],
  exports: [BullModule],
})
export class RedisBullModule {}
