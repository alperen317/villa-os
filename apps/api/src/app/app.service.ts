import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './infra/prisma/prisma.service';
import { RedisService } from './infra/redis/redis.service';

/**
 * A dead dependency does not fail fast on its own: ioredis queues commands and
 * keeps retrying while the server is unreachable, and the Postgres driver can
 * block on connect. Unbounded, the health request hangs instead of answering,
 * which reads to an orchestrator as a timeout rather than a clean 503.
 */
const PING_TIMEOUT_MS = 2_000;

export type DependencyState = 'up' | 'down';

export interface HealthReport {
  status: 'ok';
  database: DependencyState;
  redis: DependencyState;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Answers 200 only when both backing services respond. Compose gates the web
   * container on this, and an orchestrator uses it to decide the API is ready
   * for traffic — so a live process with a dead database has to fail here
   * rather than report "ok".
   */
  async checkHealth(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([this.pingDatabase(), this.pingRedis()]);

    if (database === 'down' || redis === 'down') {
      throw new ServiceUnavailableException({ status: 'degraded', database, redis });
    }

    return { status: 'ok', database, redis };
  }

  private async pingDatabase(): Promise<DependencyState> {
    try {
      await this.withTimeout(this.prisma.$queryRaw`SELECT 1`);
      return 'up';
    } catch (error) {
      this.logger.error(`Database health check failed: ${error}`);
      return 'down';
    }
  }

  private async pingRedis(): Promise<DependencyState> {
    try {
      await this.withTimeout(this.redis.ping());
      return 'up';
    } catch (error) {
      this.logger.error(`Redis health check failed: ${error}`);
      return 'down';
    }
  }

  private withTimeout<T>(probe: PromiseLike<T>): Promise<T> {
    return Promise.race([
      probe,
      new Promise<never>((_, reject) => {
        // unref: a pending probe must never hold the process open on shutdown.
        setTimeout(
          () => reject(new Error(`probe timed out after ${PING_TIMEOUT_MS}ms`)),
          PING_TIMEOUT_MS,
        ).unref();
      }),
    ]);
  }
}
