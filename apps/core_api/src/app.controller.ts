import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('health')
  async health() {
    // 1) Postgres
    await this.prisma.$queryRaw`SELECT 1`;

    // 2) Redis
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    const pong = await redis.ping();
    await redis.quit();

    return {
      ok: true,
      postgres: 'ok',
      redis: pong,
      timestamp: new Date().toISOString(),
    };
  }
}
