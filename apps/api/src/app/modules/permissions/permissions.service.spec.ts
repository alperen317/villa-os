import { expectRejectionCode } from '../../common/errors/expect-error-code';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: {
    rolePermission: { findMany: jest.Mock; upsert: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      rolePermission: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new PermissionsService(prisma as unknown as PrismaService);
  });

  describe('with no DB overrides', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('falls back to the catalog defaults (matches current hardcoded @Roles behavior)', () => {
      expect(service.isAllowed('Operations', 'villas.read')).toBe(true);
      expect(service.isAllowed('Housekeeping', 'villas.read')).toBe(true);
      expect(service.isAllowed('Operations', 'villas.write')).toBe(false);
      expect(service.isAllowed('Accounting', 'payments.write')).toBe(true);
      expect(service.isAllowed('Operations', 'payments.write')).toBe(false);
    });

    it('getMatrix returns one row per catalog entry with values for every configurable role', async () => {
      const matrix = await service.getMatrix();

      const villasRead = matrix.find((row) => row.key === 'villas.read');
      expect(villasRead?.values).toEqual({ Operations: true, Accounting: true, Housekeeping: true });

      const usersManage = matrix.find((row) => row.key === 'users.manage');
      expect(usersManage?.values).toEqual({ Operations: false, Accounting: false, Housekeeping: false });
    });
  });

  describe('with a DB override', () => {
    it('a DB row overrides the catalog default', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([
        { role: 'Operations', permissionKey: 'villas.read', allowed: false },
      ]);
      await service.onModuleInit();

      expect(service.isAllowed('Operations', 'villas.read')).toBe(false);
      // Untouched roles for the same key keep their catalog default.
      expect(service.isAllowed('Accounting', 'villas.read')).toBe(true);
    });
  });

  describe('updateMatrix', () => {
    it('rejects attempts to write an Administrator row', async () => {
      await expectRejectionCode(
        service.updateMatrix([{ role: 'Administrator', permissionKey: 'villas.write', allowed: true }]),
        ErrorCode.ROLE_PERMISSIONS_IMMUTABLE,
        400,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('upserts valid updates and refreshes the in-memory cache', async () => {
      await service.onModuleInit();
      expect(service.isAllowed('Operations', 'villas.write')).toBe(false);

      prisma.rolePermission.upsert.mockResolvedValue({});
      prisma.rolePermission.findMany.mockResolvedValue([
        { role: 'Operations', permissionKey: 'villas.write', allowed: true },
      ]);

      await service.updateMatrix([{ role: 'Operations', permissionKey: 'villas.write', allowed: true }]);

      expect(prisma.rolePermission.upsert).toHaveBeenCalledWith({
        where: { role_permissionKey: { role: 'Operations', permissionKey: 'villas.write' } },
        create: { role: 'Operations', permissionKey: 'villas.write', allowed: true },
        update: { allowed: true },
      });
      expect(service.isAllowed('Operations', 'villas.write')).toBe(true);
    });
  });
});
