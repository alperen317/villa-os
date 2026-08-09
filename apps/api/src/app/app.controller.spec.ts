import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;
  let appService: { checkHealth: jest.Mock };

  beforeEach(async () => {
    appService = { checkHealth: jest.fn() };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appService }],
    }).compile();

    controller = app.get(AppController);
  });

  describe('health', () => {
    it('returns the health report', async () => {
      const report = { status: 'ok' as const, database: 'up' as const, redis: 'up' as const };
      appService.checkHealth.mockResolvedValue(report);

      await expect(controller.health()).resolves.toBe(report);
    });

    it('lets a failing health check propagate', async () => {
      appService.checkHealth.mockRejectedValue(new Error('degraded'));

      await expect(controller.health()).rejects.toThrow('degraded');
    });
  });
});
