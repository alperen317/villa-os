import { expectRejectionCode } from '../../common/errors/expect-error-code';
import { ErrorCode } from '../../common/errors/error-codes';
import { Test } from '@nestjs/testing';
import { SafeUser, UsersRepository } from './users.repository';
import { UsersService } from './users.service';

function safeUser(overrides: Partial<SafeUser> = {}): SafeUser {
  return {
    id: 'user-1',
    username: 'operations',
    role: 'Operations',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as SafeUser;
}

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            findById: jest.fn(),
            usernameExists: jest.fn(),
            update: jest.fn(),
            setActive: jest.fn(),
            updatePassword: jest.fn(),
            countActiveByRole: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
    repository = moduleRef.get(UsersRepository);
  });

  describe('create', () => {
    it('rejects a username that is already taken', async () => {
      repository.usernameExists.mockResolvedValue(true);

      await expectRejectionCode(
        service.create({ username: 'taken', password: 'a-strong-password', role: 'Operations' as never }),
        ErrorCode.USER_USERNAME_TAKEN,
        409,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('setActive', () => {
    it('rejects a user deactivating their own account', async () => {
      const user = safeUser({ id: 'self-1' });
      repository.findById.mockResolvedValue(user);

      await expectRejectionCode(
        service.setActive('self-1', false, 'self-1'),
        ErrorCode.USER_CANNOT_DEACTIVATE_SELF,
        403,
      );
      expect(repository.setActive).not.toHaveBeenCalled();
    });

    it('rejects deactivating the last active Administrator', async () => {
      const admin = safeUser({ id: 'admin-1', role: 'Administrator' as never });
      repository.findById.mockResolvedValue(admin);
      repository.countActiveByRole.mockResolvedValue(1);

      await expectRejectionCode(
        service.setActive('admin-1', false, 'someone-else'),
        ErrorCode.USER_LAST_ACTIVE_ADMINISTRATOR,
        409,
      );
      expect(repository.setActive).not.toHaveBeenCalled();
    });

    it('allows deactivating an Administrator when other active admins remain', async () => {
      const admin = safeUser({ id: 'admin-1', role: 'Administrator' as never });
      repository.findById.mockResolvedValue(admin);
      repository.countActiveByRole.mockResolvedValue(2);
      repository.setActive.mockResolvedValue({ ...admin, isActive: false });

      await service.setActive('admin-1', false, 'someone-else');

      expect(repository.setActive).toHaveBeenCalledWith('admin-1', false);
    });

    it('rejects when the target user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expectRejectionCode(
        service.setActive('missing', false, 'someone-else'),
        ErrorCode.USER_NOT_FOUND,
        404,
      );
    });
  });
});
