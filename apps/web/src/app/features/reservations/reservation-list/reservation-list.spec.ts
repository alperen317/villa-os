import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../../core/auth/auth.service';
import { ViewportService } from '../../../core/layout/viewport.service';
import { Reservation } from '../../../core/models/reservation.model';
import { SyncQueueStore } from '../../../core/sync/sync-queue.store';
import { CustomersService } from '../../customers/customers.service';
import { VillasService } from '../../villas/villas.service';
import { VillasStore } from '../../villas/villas.store';
import { PaymentsService } from '../payments.service';
import { ReservationsService } from '../reservations.service';
import { ReservationList } from './reservation-list';

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'reservation-1',
    reservationNumber: 'RES-1',
    villaId: 'villa-1',
    floorId: 'floor-1',
    customerId: 'customer-1',
    checkIn: '2026-03-10T00:00:00.000Z',
    checkOut: '2026-03-14T00:00:00.000Z',
    guestCount: 2,
    totalPrice: '1000',
    status: 'Confirmed',
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    villa: { id: 'villa-1', name: 'Villa 1' },
    floor: { id: 'floor-1', name: 'Floor 1', isEntireVilla: false },
    customer: { id: 'customer-1', firstName: 'Ada', lastName: 'Lovelace' },
    ...overrides,
  };
}

describe('ReservationList', () => {
  let component: ReservationList;
  let reservationsService: {
    list: jest.Mock;
    get: jest.Mock;
    remove: jest.Mock;
  };
  let currentUser: ReturnType<typeof signal<{ role: string } | null>>;
  let message: { success: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    reservationsService = {
      list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      get: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    currentUser = signal<{ role: string } | null>(null);
    message = { success: jest.fn(), error: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: ReservationsService, useValue: reservationsService },
        {
          provide: VillasService,
          useValue: { list: jest.fn(), listFloors: jest.fn() },
        },
        {
          provide: VillasStore,
          useValue: { villas: signal([]), ensureLoaded: jest.fn() },
        },
        {
          provide: CustomersService,
          useValue: { list: jest.fn(), create: jest.fn() },
        },
        {
          provide: PaymentsService,
          useValue: { getSummary: jest.fn(), create: jest.fn() },
        },
        { provide: AuthService, useValue: { currentUser } },
        { provide: ViewportService, useValue: { isMobile: signal(true) } },
        {
          provide: SyncQueueStore,
          useValue: {
            items: signal([]),
            totalCount: signal(0),
            resolveTarget: jest.fn().mockReturnValue(null),
            clearResolveTarget: jest.fn(),
          },
        },
        { provide: NzMessageService, useValue: message },
        { provide: Router, useValue: { navigate: jest.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
      ],
    });

    // Constructed rather than rendered: every dependency arrives through inject(), and the
    // behaviour under test is the calendar's bookkeeping, not ng-zorro's template.
    component = TestBed.runInInjectionContext(() => new ReservationList());
  });

  describe('onCalendarSelect', () => {
    it('moves both the grid and the day panel when a day is tapped', () => {
      component['activeCalendarDate'].set(new Date(2026, 2, 10));
      component['selectedCalendarDate'].set(new Date(2026, 2, 10));

      component.onCalendarSelect(new Date(2026, 2, 18));

      expect(component['selectedCalendarDate']().getDate()).toBe(18);
      expect(component['activeCalendarDate']().getDate()).toBe(18);
    });

    it('leaves the day panel alone when the header pages to another month', () => {
      // ng-zorro emits nzSelectChange for header navigation too, keeping the day-of-month —
      // following it would rewrite the panel under a date the user never chose.
      component['activeCalendarDate'].set(new Date(2026, 2, 10));
      component['selectedCalendarDate'].set(new Date(2026, 2, 10));

      component.onCalendarSelect(new Date(2026, 3, 10));

      expect(component['selectedCalendarDate']().getMonth()).toBe(2);
      expect(component['activeCalendarDate']().getMonth()).toBe(3);
    });

    it('still selects a day in another month when the day-of-month differs', () => {
      component['activeCalendarDate'].set(new Date(2026, 2, 10));
      component['selectedCalendarDate'].set(new Date(2026, 2, 10));

      component.onCalendarSelect(new Date(2026, 3, 2));

      expect(component['selectedCalendarDate']().getMonth()).toBe(3);
      expect(component['selectedCalendarDate']().getDate()).toBe(2);
    });

    it('re-selects the same day within the month rather than reading it as navigation', () => {
      component['activeCalendarDate'].set(new Date(2026, 2, 10));
      component['selectedCalendarDate'].set(new Date(2026, 2, 5));

      component.onCalendarSelect(new Date(2026, 2, 10));

      expect(component['selectedCalendarDate']().getDate()).toBe(10);
    });

    it('reloads the calendar only when the month actually changes', () => {
      component['activeCalendarDate'].set(new Date(2026, 2, 10));

      component.onCalendarSelect(new Date(2026, 2, 18));
      expect(reservationsService.list).not.toHaveBeenCalled();

      component.onCalendarSelect(new Date(2026, 3, 18));
      expect(reservationsService.list).toHaveBeenCalled();
    });
  });

  describe('loadCalendarData', () => {
    it('bounds the fetch to the visible month, padded for the days either side', async () => {
      component['activeCalendarDate'].set(new Date(2026, 2, 15));

      await component.loadCalendarData();

      expect(reservationsService.list).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: '2026-02-22',
          dateTo: '2026-04-07',
          page: 1,
        }),
      );
    });

    it('drains the remaining pages, so an empty day panel means an empty day', async () => {
      // The panel renders "no arrivals or departures" as an answer; a clipped page would
      // make that a false negative rather than a visibly short list.
      reservationsService.list
        .mockResolvedValueOnce({ data: [reservation({ id: 'a' })], total: 150 })
        .mockResolvedValueOnce({
          data: [reservation({ id: 'b' })],
          total: 150,
        });

      await component.loadCalendarData();

      expect(reservationsService.list).toHaveBeenCalledTimes(2);
      expect(component['calendarReservations']()).toHaveLength(2);
    });

    it('lets only the newest run publish when months are paged quickly', async () => {
      let releaseFirst: (value: { data: Reservation[]; total: number }) => void = () => undefined;
      reservationsService.list
        .mockReturnValueOnce(new Promise((resolve) => (releaseFirst = resolve)))
        .mockResolvedValue({ data: [reservation({ id: 'newer' })], total: 1 });

      const stale = component.loadCalendarData();
      await component.loadCalendarData();
      releaseFirst({ data: [reservation({ id: 'older' })], total: 1 });
      await stale;

      expect(component['calendarReservations']().map((item) => item.id)).toEqual(['newer']);
    });
  });

  describe('delete', () => {
    it.each([
      ['Administrator', true],
      ['Operations', false],
      ['Accounting', false],
      ['Housekeeping', false],
    ])('offers deletion to %s: %s', (role, allowed) => {
      // reservations.delete is granted to no configurable role, so anyone but the admin
      // would only ever get a 403 out of the button.
      currentUser.set({ role });

      expect(component['canDelete']()).toBe(allowed);
    });

    it('is hidden from a signed-out session', () => {
      currentUser.set(null);

      expect(component['canDelete']()).toBe(false);
    });

    it('re-reads the list after deleting, so the row disappears', async () => {
      await component.remove(reservation({ id: 'reservation-9' }));

      expect(reservationsService.remove).toHaveBeenCalledWith('reservation-9');
      expect(reservationsService.list).toHaveBeenCalled();
      expect(message.success).toHaveBeenCalled();
    });

    it('also refreshes the calendar when that is the open view', async () => {
      component.setViewMode('calendar');
      reservationsService.list.mockClear();

      await component.remove(reservation());

      // Two reads: the list page and the calendar window.
      expect(reservationsService.list.mock.calls.length).toBeGreaterThan(1);
    });

    it("surfaces the API's reason rather than a generic failure", async () => {
      // The refusals are worth reading — the stay is in progress, or payments hang off it.
      reservationsService.remove.mockRejectedValue({
        error: { message: 'Ödeme kaydı olan rezervasyon silinemez' },
      });

      await component.remove(reservation());

      expect(message.error).toHaveBeenCalledWith('Ödeme kaydı olan rezervasyon silinemez');
      expect(message.success).not.toHaveBeenCalled();
    });
  });

  describe('day matching', () => {
    it('files a stay under the calendar day it was booked for, not the local reading of midnight UTC', () => {
      // checkIn is a @db.Date that travels as midnight UTC; reading it with local getters
      // lands on the previous day anywhere west of UTC.
      component['calendarReservations'].set([
        reservation({
          checkIn: '2026-03-10T00:00:00.000Z',
          checkOut: '2026-03-14T00:00:00.000Z',
        }),
      ]);

      expect(component.checkInsForDate(new Date(2026, 2, 10))).toHaveLength(1);
      expect(component.checkInsForDate(new Date(2026, 2, 9))).toHaveLength(0);
      expect(component.checkOutsForDate(new Date(2026, 2, 14))).toHaveLength(1);
    });
  });
});
