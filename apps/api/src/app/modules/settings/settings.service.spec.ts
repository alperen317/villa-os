import { Test } from '@nestjs/testing';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { UPLOADS_ROOT } from '../../infra/uploads/uploads-path';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';
import { Settings } from '../../../generated/prisma/client';

jest.mock('fs', () => ({ existsSync: jest.fn(), unlinkSync: jest.fn() }));

const existsSyncMock = existsSync as jest.MockedFunction<typeof existsSync>;
const unlinkSyncMock = unlinkSync as jest.MockedFunction<typeof unlinkSync>;

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: 'settings-1',
    companyName: 'Villa OS',
    accentColor: '#2563eb',
    logoPath: null,
    contactEmail: null,
    contactPhone: null,
    contactAddress: null,
    ...overrides,
  } as Settings;
}

describe('SettingsService', () => {
  let service: SettingsService;
  let repository: jest.Mocked<SettingsRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();
    existsSyncMock.mockReturnValue(true);

    const moduleRef = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: SettingsRepository,
          useValue: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(SettingsService);
    repository = moduleRef.get(SettingsRepository);
  });

  describe('getOrCreate', () => {
    it('returns the existing row when there is one', async () => {
      const existing = settings();
      repository.findFirst.mockResolvedValue(existing);

      expect(await service.getOrCreate()).toBe(existing);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('seeds a row on first access, so the login screen always has branding to read', async () => {
      repository.findFirst.mockResolvedValue(null);
      repository.create.mockResolvedValue(settings());

      await service.getOrCreate();

      expect(repository.create).toHaveBeenCalledWith({});
    });
  });

  describe('updateLogo', () => {
    it('removes the file the previous logo pointed at, so replacing does not leak orphans', async () => {
      repository.findFirst.mockResolvedValue(
        settings({ logoPath: '/uploads/logo/old.png' }),
      );
      repository.update.mockResolvedValue(
        settings({ logoPath: '/uploads/logo/new.png' }),
      );

      await service.updateLogo('/uploads/logo/new.png');

      expect(unlinkSyncMock).toHaveBeenCalledWith(
        join(UPLOADS_ROOT, 'logo/old.png'),
      );
      expect(repository.update).toHaveBeenCalledWith('settings-1', {
        logoPath: '/uploads/logo/new.png',
      });
    });

    it('has nothing to clean up when no logo was set', async () => {
      repository.findFirst.mockResolvedValue(settings({ logoPath: null }));
      repository.update.mockResolvedValue(settings());

      await service.updateLogo('/uploads/logo/new.png');

      expect(unlinkSyncMock).not.toHaveBeenCalled();
    });

    it('leaves alone a stored path that does not point into the uploads directory', async () => {
      repository.findFirst.mockResolvedValue(
        settings({ logoPath: '/etc/passwd' }),
      );
      repository.update.mockResolvedValue(settings());

      await service.updateLogo('/uploads/logo/new.png');

      expect(unlinkSyncMock).not.toHaveBeenCalled();
    });

    it('does not try to unlink a file that is already gone', async () => {
      repository.findFirst.mockResolvedValue(
        settings({ logoPath: '/uploads/logo/old.png' }),
      );
      repository.update.mockResolvedValue(settings());
      existsSyncMock.mockReturnValue(false);

      await service.updateLogo('/uploads/logo/new.png');

      expect(unlinkSyncMock).not.toHaveBeenCalled();
    });
  });

  describe('removeLogo', () => {
    it('clears the column and deletes the file behind it', async () => {
      repository.findFirst.mockResolvedValue(
        settings({ logoPath: '/uploads/logo/old.png' }),
      );
      repository.update.mockResolvedValue(settings({ logoPath: null }));

      await service.removeLogo();

      expect(unlinkSyncMock).toHaveBeenCalledWith(
        join(UPLOADS_ROOT, 'logo/old.png'),
      );
      expect(repository.update).toHaveBeenCalledWith('settings-1', {
        logoPath: null,
      });
    });
  });

  describe('update', () => {
    it('writes only the branding fields, never the logo path', async () => {
      repository.findFirst.mockResolvedValue(settings());
      repository.update.mockResolvedValue(settings({ companyName: 'Yeni Ad' }));

      await service.update({ companyName: 'Yeni Ad', accentColor: '#0f766e' });

      expect(repository.update).toHaveBeenCalledWith('settings-1', {
        companyName: 'Yeni Ad',
        accentColor: '#0f766e',
        contactEmail: undefined,
        contactPhone: undefined,
        contactAddress: undefined,
      });
    });
  });
});
