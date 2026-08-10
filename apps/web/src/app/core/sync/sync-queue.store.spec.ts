import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api-base-url';
import { Reservation } from '../models/reservation.model';
import { syncOutboxDb } from './sync-outbox.db';
import { SyncQueueStore } from './sync-queue.store';

jest.mock('./sync-outbox.db', () => ({
  syncOutboxDb: {
    getAll: jest.fn().mockResolvedValue([]),
    put: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
}));

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
}

/** Lets queued microtasks (chained awaits inside the store) settle between two HttpTestingController steps. */
async function flushMicrotasks(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

function reservationFixture(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'reservation-1',
    reservationNumber: 'RES-1',
    villaId: 'villa-1',
    floorId: 'floor-1',
    customerId: 'customer-1',
    checkIn: '2026-08-10',
    checkOut: '2026-08-12',
    guestCount: 2,
    totalPrice: '1000',
    status: 'Pending',
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    villa: { id: 'villa-1', name: 'Villa 1' },
    floor: { id: 'floor-1', name: 'Floor 1', isEntireVilla: false },
    customer: { id: 'customer-1', firstName: 'Ada', lastName: 'Lovelace' },
    ...overrides,
  };
}

const createPayload = {
  customerId: 'customer-1',
  villaId: 'villa-1',
  floorId: 'floor-1',
  checkIn: '2026-08-10',
  checkOut: '2026-08-12',
  guestCount: 2,
};

describe('SyncQueueStore', () => {
  let store: InstanceType<typeof SyncQueueStore>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    setOnline(true);
    jest.clearAllMocks();
    (syncOutboxDb.getAll as jest.Mock).mockResolvedValue([]);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    store = TestBed.inject(SyncQueueStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('enqueues a create as a pending item and persists it to the outbox', async () => {
    const item = await store.enqueueCreate(createPayload, 'Villa 1 / Floor 1 · Ada Lovelace');

    expect(item.status).toBe('pending');
    expect(item.type).toBe('create-reservation');
    expect(store.items()).toEqual([item]);
    expect(syncOutboxDb.put).toHaveBeenCalledWith(item);
  });

  it('does not replay while offline', async () => {
    setOnline(false);
    await store.enqueueCreate(createPayload, 'summary');

    await store.replay();

    httpMock.expectNone(`${API_BASE_URL}/reservations`);
  });

  it('syncs a pending create and removes it from the outbox once the server confirms', async () => {
    const item = await store.enqueueCreate(createPayload, 'summary');

    const replayPromise = store.replay();
    await flushMicrotasks();
    const req = httpMock.expectOne(`${API_BASE_URL}/reservations`);
    expect(req.request.headers.get('Idempotency-Key')).toBe(item.id);
    req.flush(reservationFixture({ id: 'real-id' }));
    await replayPromise;

    expect(store.items()).toHaveLength(0);
    expect(syncOutboxDb.delete).toHaveBeenCalledWith(item.id);
  });

  it('marks a create conflict when the server reports an overlapping reservation', async () => {
    await store.enqueueCreate(createPayload, 'summary');

    const replayPromise = store.replay();
    await flushMicrotasks();
    const req = httpMock.expectOne(`${API_BASE_URL}/reservations`);
    req.flush(
      {
        message: 'These dates conflict with an existing reservation',
        conflictingReservationId: 'other-id',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await replayPromise;

    const [item] = store.items();
    expect(item.status).toBe('conflict');
    expect(item.conflictingReservationId).toBe('other-id');
  });

  it('pauses the queue on a 401 and leaves the item pending for retry after re-login', async () => {
    await store.enqueueCreate(createPayload, 'summary');

    const replayPromise = store.replay();
    await flushMicrotasks();
    const req = httpMock.expectOne(`${API_BASE_URL}/reservations`);
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    await replayPromise;

    expect(store.sessionExpired()).toBe(true);
    expect(store.items()[0].status).toBe('pending');
  });

  it('escalates to a conflict after repeated network failures', async () => {
    await store.enqueueCreate(createPayload, 'summary');

    for (let attempt = 0; attempt < 5; attempt++) {
      const replayPromise = store.replay();
      await flushMicrotasks();
      const req = httpMock.expectOne(`${API_BASE_URL}/reservations`);
      req.error(new ProgressEvent('error'));
      await replayPromise;
    }

    const [item] = store.items();
    expect(item.status).toBe('conflict');
    expect(item.attempts).toBe(5);
  });

  it('treats "already Cancelled" as a resolved no-op instead of a conflict', async () => {
    await store.enqueueCancel('reservation-1', 'summary');

    const replayPromise = store.replay();
    await flushMicrotasks();
    const req = httpMock.expectOne(`${API_BASE_URL}/reservations/reservation-1/cancel`);
    req.flush(
      { message: 'Cannot move a reservation from Cancelled to Cancelled' },
      { status: 409, statusText: 'Conflict' },
    );
    await replayPromise;

    expect(store.items()).toHaveLength(0);
  });

  it('resolves a dependent update to the real id once its create syncs in the same pass', async () => {
    const createItem = await store.enqueueCreate(createPayload, 'create summary');
    await store.enqueueUpdate(
      `local:${createItem.id}`,
      { guestCount: 3 },
      new Date().toISOString(),
      'update summary',
    );

    const replayPromise = store.replay();
    await flushMicrotasks();

    const createReq = httpMock.expectOne(`${API_BASE_URL}/reservations`);
    createReq.flush(reservationFixture({ id: 'real-reservation-id' }));
    await flushMicrotasks();

    const updateReq = httpMock.expectOne(`${API_BASE_URL}/reservations/real-reservation-id`);
    expect(updateReq.request.body.guestCount).toBe(3);
    updateReq.flush(reservationFixture({ id: 'real-reservation-id', guestCount: 3 }));

    await replayPromise;

    expect(store.items()).toHaveLength(0);
  });
});
