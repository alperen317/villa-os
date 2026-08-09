import { ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './infra/prisma/prisma.service';
import { RedisService } from './infra/redis/redis.service';

describe('AppService', () => {
  let service: AppService;
  let prisma: { $queryRaw: jest.Mock };
  let redis: { ping: jest.Mock };

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    redis = { ping: jest.fn().mockResolvedValue('PONG') };

    service = new AppService(prisma as unknown as PrismaService, redis as unknown as RedisService);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
  });

  describe('checkHealth', () => {
    it('reports ok when both backing services answer', async () => {
      await expect(service.checkHealth()).resolves.toEqual({
        status: 'ok',
        database: 'up',
        redis: 'up',
      });
    });

    it('fails when the database is unreachable', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

      // A live process with a dead database must not look healthy to compose.
      await expect(service.checkHealth()).rejects.toThrow(ServiceUnavailableException);
    });

    it('fails when Redis is unreachable', async () => {
      redis.ping.mockRejectedValue(new Error('connection refused'));

      await expect(service.checkHealth()).rejects.toThrow(ServiceUnavailableException);
    });

    it('names the failing dependency in the response body', async () => {
      redis.ping.mockRejectedValue(new Error('connection refused'));

      await expect(service.checkHealth()).rejects.toMatchObject({
        response: { status: 'degraded', database: 'up', redis: 'down' },
      });
    });

    it('reports a hanging dependency as down instead of hanging with it', async () => {
      jest.useFakeTimers();
      // ioredis queues and retries while the server is unreachable rather than
      // rejecting, so an unbounded probe never settles.
      redis.ping.mockReturnValue(new Promise(() => undefined));

      const health = service.checkHealth();
      const assertion = expect(health).rejects.toMatchObject({
        response: { database: 'up', redis: 'down' },
      });

      await jest.advanceTimersByTimeAsync(2_000);
      await assertion;

      jest.useRealTimers();
    });
  });
});
