import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../../core/auth/auth.service';
import { HousekeepingTask } from '../../../core/models/housekeeping.model';
import { VillasStore } from '../../villas/villas.store';
import { HousekeepingService } from '../housekeeping.service';
import { HousekeepingQueue } from './housekeeping-queue';

function task(overrides: Partial<HousekeepingTask> = {}): HousekeepingTask {
  return {
    id: 'task-1',
    villaId: 'villa-1',
    reservationId: null,
    assignedUserId: null,
    status: 'Pending',
    startedAt: null,
    completedAt: null,
    notes: null,
    villa: { id: 'villa-1', name: 'Villa 1' },
    reservation: null,
    assignedUser: null,
    ...overrides,
  } as HousekeepingTask;
}

describe('HousekeepingQueue', () => {
  let component: HousekeepingQueue;
  let housekeepingService: {
    list: jest.Mock;
    create: jest.Mock;
    start: jest.Mock;
    complete: jest.Mock;
  };
  let currentUser: ReturnType<typeof signal<{ role: string } | null>>;
  let message: { success: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    housekeepingService = {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(task()),
      start: jest.fn().mockResolvedValue(task({ status: 'InProgress' })),
      complete: jest.fn().mockResolvedValue(task({ status: 'Completed' })),
    };
    currentUser = signal<{ role: string } | null>(null);
    message = { success: jest.fn(), error: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: HousekeepingService, useValue: housekeepingService },
        { provide: VillasStore, useValue: { villas: signal([]), ensureLoaded: jest.fn() } },
        { provide: AuthService, useValue: { currentUser } },
        { provide: NzMessageService, useValue: message },
      ],
    });

    component = TestBed.runInInjectionContext(() => new HousekeepingQueue());
  });

  describe('canManage', () => {
    it.each([
      ['Administrator', true],
      ['Housekeeping', true],
      ['Operations', false],
      ['Accounting', false],
    ])('is %s allowed to act on the queue: %s', (role, allowed) => {
      currentUser.set({ role });

      expect(component['canManage']()).toBe(allowed);
    });

    it('is closed to a signed-out session rather than open by default', () => {
      currentUser.set(null);

      expect(component['canManage']()).toBe(false);
    });
  });

  describe('tasksForStatus', () => {
    it('splits the queue by status, which is what the three columns render', () => {
      component['tasks'].set([
        task({ id: 'a', status: 'Pending' }),
        task({ id: 'b', status: 'InProgress' }),
        task({ id: 'c', status: 'Pending' }),
        task({ id: 'd', status: 'Completed' }),
      ]);

      expect(component.tasksForStatus('Pending').map((item) => item.id)).toEqual(['a', 'c']);
      expect(component.tasksForStatus('InProgress').map((item) => item.id)).toEqual(['b']);
      expect(component.tasksForStatus('Completed').map((item) => item.id)).toEqual(['d']);
    });
  });

  describe('acting on a task', () => {
    it('re-reads the queue after starting, so the card moves column', async () => {
      await component.start(task());

      expect(housekeepingService.start).toHaveBeenCalledWith('task-1');
      expect(housekeepingService.list).toHaveBeenCalled();
      expect(message.success).toHaveBeenCalled();
    });

    it('clears the acting marker even when the API refuses', async () => {
      // The API now rejects a transition another worker already made; leaving the marker set
      // would strand the row in a spinner it never comes out of.
      housekeepingService.complete.mockRejectedValue(new Error('409'));

      await component.complete(task({ status: 'InProgress' }));

      expect(component['actingTaskId']()).toBeNull();
      expect(message.error).toHaveBeenCalled();
    });

    it('marks which task is mid-flight so only that card disables', async () => {
      let release: (value: unknown) => void = () => undefined;
      housekeepingService.start.mockReturnValue(new Promise((resolve) => (release = resolve)));

      const acting = component.start(task({ id: 'task-9' }));
      expect(component['actingTaskId']()).toBe('task-9');

      release(task());
      await acting;
      expect(component['actingTaskId']()).toBeNull();
    });
  });

  describe('filtering', () => {
    it('passes the chosen villa through, and omits it when cleared', async () => {
      component['filterVillaId'].set('villa-7');
      await component.loadTasks();
      expect(housekeepingService.list).toHaveBeenLastCalledWith({ villaId: 'villa-7' });

      component['filterVillaId'].set(null);
      await component.loadTasks();
      expect(housekeepingService.list).toHaveBeenLastCalledWith({ villaId: undefined });
    });

    it('stops the spinner when the queue cannot be read', async () => {
      housekeepingService.list.mockRejectedValue(new Error('offline'));

      await component.loadTasks();

      expect(component['loading']()).toBe(false);
      expect(message.error).toHaveBeenCalled();
    });
  });
});
