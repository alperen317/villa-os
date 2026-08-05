import { ReservationsRepository } from './reservations.repository';
import { PrismaService } from '../../infra/prisma/prisma.service';

function createPrismaMock() {
  return {
    reservation: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
}

describe('ReservationsRepository.findConflicting (BR-004..BR-007)', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let repository: ReservationsRepository;

  beforeEach(() => {
    prisma = createPrismaMock();
    repository = new ReservationsRepository(prisma as unknown as PrismaService);
  });

  it('blocks against every floor of the villa when booking the Entire Villa (BR-004)', async () => {
    await repository.findConflicting({
      villaId: 'villa-1',
      floorId: 'floor-entire',
      isEntireVillaFloor: true,
      checkIn: new Date('2026-08-01'),
      checkOut: new Date('2026-08-05'),
    });

    const where = prisma.reservation.findFirst.mock.calls[0][0].where;
    expect(where.floor).toEqual({ villaId: 'villa-1' });
    expect(where.OR).toBeUndefined();
  });

  it('blocks against its own floor and the Entire Villa floor when booking a regular floor (BR-005/BR-006)', async () => {
    await repository.findConflicting({
      villaId: 'villa-1',
      floorId: 'floor-ground',
      isEntireVillaFloor: false,
      checkIn: new Date('2026-08-01'),
      checkOut: new Date('2026-08-05'),
    });

    const where = prisma.reservation.findFirst.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { floorId: 'floor-ground' },
      { floor: { villaId: 'villa-1', isEntireVilla: true } },
    ]);
  });

  it('does not reference other regular floors, allowing Ground and Upper Floor to be booked simultaneously (BR-007)', async () => {
    await repository.findConflicting({
      villaId: 'villa-1',
      floorId: 'floor-ground',
      isEntireVillaFloor: false,
      checkIn: new Date('2026-08-01'),
      checkOut: new Date('2026-08-05'),
    });

    const where = prisma.reservation.findFirst.mock.calls[0][0].where;
    const floorIdChecks = where.OR.filter((clause: { floorId?: string }) => 'floorId' in clause);
    expect(floorIdChecks).toEqual([{ floorId: 'floor-ground' }]);
    expect(floorIdChecks).not.toContainEqual({ floorId: 'floor-upper' });
  });

  it('excludes cancelled reservations and the reservation being edited', async () => {
    await repository.findConflicting({
      villaId: 'villa-1',
      floorId: 'floor-ground',
      isEntireVillaFloor: false,
      checkIn: new Date('2026-08-01'),
      checkOut: new Date('2026-08-05'),
      excludeReservationId: 'reservation-being-edited',
    });

    const where = prisma.reservation.findFirst.mock.calls[0][0].where;
    expect(where.status).toEqual({ not: 'Cancelled' });
    expect(where.id).toEqual({ not: 'reservation-being-edited' });
  });

  it('filters by date overlap using an exclusive-boundary comparison', async () => {
    const checkIn = new Date('2026-08-01');
    const checkOut = new Date('2026-08-05');

    await repository.findConflicting({
      villaId: 'villa-1',
      floorId: 'floor-ground',
      isEntireVillaFloor: false,
      checkIn,
      checkOut,
    });

    const where = prisma.reservation.findFirst.mock.calls[0][0].where;
    expect(where.checkIn).toEqual({ lt: checkOut });
    expect(where.checkOut).toEqual({ gt: checkIn });
  });
});
