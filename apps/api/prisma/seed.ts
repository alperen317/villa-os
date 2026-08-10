import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  ExpenseCategory,
  HousekeepingStatus,
  MaintenancePriority,
  MaintenanceStatus,
  PaymentMethod,
  ReservationStatus,
} from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pick<T>(items: readonly T[]): T {
  return items[randInt(0, items.length - 1)];
}

function chance(probability: number): boolean {
  return Math.random() < probability;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

interface DateInterval {
  checkIn: Date;
  checkOut: Date;
}

function overlaps(a: DateInterval, b: DateInterval): boolean {
  return a.checkIn < b.checkOut && a.checkOut > b.checkIn;
}

// ---------------------------------------------------------------------------
// Mock data pools
// ---------------------------------------------------------------------------

const MALE_FIRST_NAMES = [
  'Mehmet',
  'Ahmet',
  'Mustafa',
  'Ali',
  'Hüseyin',
  'Hasan',
  'İbrahim',
  'Osman',
  'Yusuf',
  'Murat',
  'Emre',
  'Burak',
  'Kemal',
  'Serkan',
  'Tolga',
  'Onur',
  'Cem',
  'Barış',
  'Kaan',
  'Erhan',
  'Fatih',
  'Cengiz',
  'Uğur',
  'Volkan',
  'Selim',
];

const FEMALE_FIRST_NAMES = [
  'Ayşe',
  'Fatma',
  'Emine',
  'Hatice',
  'Zeynep',
  'Elif',
  'Merve',
  'Esra',
  'Selin',
  'Deniz',
  'Gamze',
  'Pınar',
  'Aylin',
  'Ebru',
  'Seda',
  'Burcu',
  'Melis',
  'Derya',
  'Nazlı',
  'Yasemin',
  'Gül',
  'Sibel',
  'Canan',
  'İpek',
  'Buse',
];

const LAST_NAMES = [
  'Yılmaz',
  'Kaya',
  'Demir',
  'Çelik',
  'Şahin',
  'Yıldız',
  'Yıldırım',
  'Öztürk',
  'Aydın',
  'Özdemir',
  'Arslan',
  'Doğan',
  'Kılıç',
  'Aslan',
  'Çetin',
  'Kara',
  'Koç',
  'Kurt',
  'Özkan',
  'Şimşek',
  'Aksoy',
  'Bulut',
  'Erdoğan',
  'Güneş',
  'Polat',
  'Aktaş',
  'Korkmaz',
  'Tunç',
  'Uçar',
  'Ergün',
];

const EMAIL_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'];

const RESERVATION_NOTES = [
  'Balayı için geliyorlar, oda süslemesi rica edildi',
  'Doğum günü kutlaması olacak',
  'Erken giriş rica edildi',
  'Evcil hayvan ile geliyorlar',
  'Geç çıkış talep edildi',
  'Havalimanı transferi gerekiyor',
  'Tekrar konaklayan misafir',
  'Bebek yatağı talep edildi',
  undefined,
  undefined,
  undefined,
  undefined,
];

const MAINTENANCE_ITEMS: { title: string; description: string }[] = [
  {
    title: 'Klima Bakımı',
    description: 'Salon ve yatak odası klimalarının periyodik bakımı ve gaz kontrolü.',
  },
  {
    title: 'Havuz Filtre Değişimi',
    description: 'Havuz filtrasyon sisteminde filtre değişimi ve su kalitesi ölçümü.',
  },
  {
    title: 'Su Tesisatı Kontrolü',
    description: 'Banyo ve mutfaktaki sızıntı şüphesi üzerine tesisat kontrolü.',
  },
  {
    title: 'Elektrik Panosu Kontrolü',
    description: 'Sigorta atması şikayeti üzerine pano ve hat kontrolü.',
  },
  {
    title: 'Kapı Kilit Tamiri',
    description: 'Bahçe kapısındaki akıllı kilidin pil ve mekanizma kontrolü.',
  },
  { title: 'Jakuzi Bakımı', description: 'Teras jakuzisinin temizliği ve pompa bakımı.' },
  {
    title: 'Bahçe ve Çim Düzenlemesi',
    description: 'Sezon öncesi çim biçme, budama ve sulama sistemi kontrolü.',
  },
  { title: 'Isıtma Sistemi Bakımı', description: 'Yerden ısıtma sisteminin sezon öncesi bakımı.' },
  {
    title: 'Pencere Contası Değişimi',
    description: 'Üst kat pencerelerinde hava sızıntısı için conta değişimi.',
  },
  {
    title: 'Boya Rötuşu',
    description: 'Konuk çıkışı sonrası duvarlarda oluşan izlerin giderilmesi.',
  },
  { title: 'Wi-Fi Modem Değişimi', description: 'Sinyal şikayeti üzerine modem yenilendi.' },
  {
    title: 'Güvenlik Kamerası Kontrolü',
    description: 'Giriş kapısı kamerasının görüntü ve kayıt kontrolü.',
  },
];

const MAINTENANCE_SUPPLIERS = [
  'Bodrum Teknik Servis',
  'Ege Tesisat',
  'Mavi Havuz Bakım',
  'Yılmaz Elektrik',
];

interface ExpenseBlueprint {
  category: ExpenseCategory;
  description: string;
  supplier: string;
  minAmount: number;
  maxAmount: number;
  minCount: number;
  maxCount: number;
}

/** Costs that belong to a specific property. */
const VILLA_EXPENSE_ITEMS: ExpenseBlueprint[] = [
  {
    category: ExpenseCategory.Utilities,
    description: 'Elektrik faturası',
    supplier: 'Aydem Elektrik',
    minAmount: 1800,
    maxAmount: 9500,
    minCount: 8,
    maxCount: 11,
  },
  {
    category: ExpenseCategory.Utilities,
    description: 'Su faturası',
    supplier: 'MUSKİ',
    minAmount: 400,
    maxAmount: 2200,
    minCount: 8,
    maxCount: 11,
  },
  {
    category: ExpenseCategory.Utilities,
    description: 'İnternet aboneliği',
    supplier: 'Türk Telekom',
    minAmount: 450,
    maxAmount: 900,
    minCount: 8,
    maxCount: 11,
  },
  {
    category: ExpenseCategory.Cleaning,
    description: 'Temizlik malzemesi alımı',
    supplier: 'Bodrum Hijyen',
    minAmount: 900,
    maxAmount: 4500,
    minCount: 4,
    maxCount: 8,
  },
  {
    category: ExpenseCategory.Cleaning,
    description: 'Havuz kimyasalı',
    supplier: 'Mavi Havuz Bakım',
    minAmount: 1200,
    maxAmount: 5500,
    minCount: 3,
    maxCount: 6,
  },
  {
    category: ExpenseCategory.Supplies,
    description: 'Nevresim ve havlu yenileme',
    supplier: 'Ege Tekstil',
    minAmount: 2500,
    maxAmount: 14000,
    minCount: 1,
    maxCount: 3,
  },
  {
    category: ExpenseCategory.Supplies,
    description: 'Misafir karşılama ikramlıkları',
    supplier: 'Migros',
    minAmount: 300,
    maxAmount: 1500,
    minCount: 4,
    maxCount: 9,
  },
];

/** Overheads with no single property behind them (`villaId` stays null). */
const GENERAL_EXPENSE_ITEMS: ExpenseBlueprint[] = [
  {
    category: ExpenseCategory.Staff,
    description: 'Personel maaş ödemesi',
    supplier: 'Bordro',
    minAmount: 45000,
    maxAmount: 78000,
    minCount: 9,
    maxCount: 11,
  },
  {
    category: ExpenseCategory.Tax,
    description: 'Emlak ve çevre temizlik vergisi',
    supplier: 'Bodrum Belediyesi',
    minAmount: 6000,
    maxAmount: 22000,
    minCount: 2,
    maxCount: 3,
  },
  {
    category: ExpenseCategory.Other,
    description: 'Mali müşavirlik ücreti',
    supplier: 'Kaya Mali Müşavirlik',
    minAmount: 4500,
    maxAmount: 7500,
    minCount: 9,
    maxCount: 11,
  },
  {
    category: ExpenseCategory.Other,
    description: 'Sigorta primi',
    supplier: 'Anadolu Sigorta',
    minAmount: 9000,
    maxAmount: 26000,
    minCount: 1,
    maxCount: 2,
  },
  {
    category: ExpenseCategory.Other,
    description: 'Rezervasyon platformu komisyonu',
    supplier: 'Booking.com',
    minAmount: 8000,
    maxAmount: 35000,
    minCount: 6,
    maxCount: 10,
  },
];

const ADHOC_HOUSEKEEPING_NOTES = [
  'Sezon öncesi genel temizlik',
  'Havuz çevresi derin temizlik',
  'Misafir şikayeti sonrası ek temizlik',
  'Aylık periyodik temizlik',
  'Bahçe mobilyalarının temizliği',
];

// ---------------------------------------------------------------------------
// Villa / floor blueprint — 6 villas at the same site, each with two rentable
// floors plus an "entire villa" option, matching how the app already models
// bookable units (see Floor.isEntireVilla in schema.prisma).
// ---------------------------------------------------------------------------

const VILLA_COUNT = 6;
const SITE_ADDRESS = 'Kızılağaç Mahallesi, Deniz Manzaralı Sitesi, Bodrum, Muğla';
const SITE_LATITUDE = 37.0304;
const SITE_LONGITUDE = 27.4425;

const WINDOW_START = addDays(new Date(), -300);
const WINDOW_END = addDays(new Date(), 65);
const NOW = new Date();

async function seedAdmin() {
  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash, role: 'Administrator' },
  });

  console.log(`Seeded admin user "${admin.username}" (role: ${admin.role})`);
  return admin;
}

async function seedCustomers(count: number) {
  const customers: { id: string }[] = [];

  for (let i = 0; i < count; i++) {
    const isMale = chance(0.5);
    const firstName = pick(isMale ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const hasEmail = chance(0.7);
    const hasPhone = chance(0.9);
    const isForeign = chance(0.12);

    const customer = await prisma.customer.create({
      data: {
        firstName,
        lastName,
        phone: hasPhone
          ? `05${randInt(30, 59)}${randInt(100, 999)}${randInt(10, 99)}${randInt(10, 99)}`
          : null,
        email: hasEmail
          ? `${firstName.toLocaleLowerCase('tr-TR')}.${lastName.toLocaleLowerCase('tr-TR')}${randInt(1, 99)}@${pick(EMAIL_DOMAINS)}`
              .normalize('NFD')
              .replace(/[̀-ͯ]/g, '')
          : null,
        identityNumber:
          !isForeign && chance(0.6) ? String(randInt(10000000000, 99999999999)) : null,
        passportNumber: isForeign ? `P${randInt(1000000, 9999999)}` : null,
        notes: chance(0.15)
          ? pick([
              'VIP müşteri',
              'Sadık müşteri, indirim uygulanıyor',
              'İletişim tercihi: WhatsApp',
            ])
          : null,
      },
      select: { id: true },
    });

    customers.push(customer);
  }

  console.log(`Seeded ${customers.length} customers`);
  return customers;
}

interface FloorPlan {
  id: string;
  name: string;
  capacity: number;
  dailyPrice: number;
  isEntireVilla: boolean;
}

async function seedVillaWithFloors(index: number) {
  const number = index + 1;
  const name = `Villa ${number}`;

  const villa = await prisma.villa.create({
    data: {
      name,
      description: `Deniz manzaralı sitede yer alan, iki katlı ve özel havuzlu ${number} numaralı villa.`,
      address: SITE_ADDRESS,
      latitude: SITE_LATITUDE,
      longitude: SITE_LONGITUDE,
      status: 'Active',
    },
    select: { id: true, name: true },
  });

  const groundPrice = roundTo(2000 + index * 120 + randInt(0, 300), 10);
  const upperPrice = roundTo(groundPrice + 300 + randInt(0, 300), 10);
  const entirePrice = roundTo((groundPrice + upperPrice) * 0.88, 50);

  const ground = await prisma.floor.create({
    data: {
      villaId: villa.id,
      name: 'Zemin Kat',
      capacity: 4,
      bedrooms: 2,
      bathrooms: 1,
      dailyPrice: groundPrice,
      rentable: true,
      isEntireVilla: false,
    },
    select: { id: true },
  });

  const upper = await prisma.floor.create({
    data: {
      villaId: villa.id,
      name: 'Üst Kat',
      capacity: 4,
      bedrooms: 2,
      bathrooms: 1,
      dailyPrice: upperPrice,
      rentable: true,
      isEntireVilla: false,
    },
    select: { id: true },
  });

  const entire = await prisma.floor.create({
    data: {
      villaId: villa.id,
      name: 'Tüm Villa',
      capacity: 8,
      bedrooms: 4,
      bathrooms: 2,
      dailyPrice: entirePrice,
      rentable: true,
      isEntireVilla: true,
    },
    select: { id: true },
  });

  const floors: FloorPlan[] = [
    {
      id: ground.id,
      name: 'Zemin Kat',
      capacity: 4,
      dailyPrice: groundPrice,
      isEntireVilla: false,
    },
    { id: upper.id, name: 'Üst Kat', capacity: 4, dailyPrice: upperPrice, isEntireVilla: false },
    { id: entire.id, name: 'Tüm Villa', capacity: 8, dailyPrice: entirePrice, isEntireVilla: true },
  ];

  return { villaId: villa.id, villaName: villa.name, floors };
}

// ---------------------------------------------------------------------------
// Booking timeline generation — mirrors the app's real conflict rule
// (reservations.repository.findConflicting): an "entire villa" booking
// blocks every floor for its span, and individual floors never double-book.
// ---------------------------------------------------------------------------

function generateEntireVillaIntervals(): DateInterval[] {
  const intervals: DateInterval[] = [];
  const targetCount = randInt(3, 5);

  for (let attempt = 0; attempt < targetCount * 8 && intervals.length < targetCount; attempt++) {
    const nights = randInt(3, 8);
    const latestStart = daysBetween(WINDOW_START, WINDOW_END) - nights;
    if (latestStart < 1) break;

    const checkIn = addDays(WINDOW_START, randInt(0, latestStart));
    const checkOut = addDays(checkIn, nights);
    const candidate: DateInterval = { checkIn, checkOut };

    const hasBufferOverlap = intervals.some((existing) =>
      overlaps(
        { checkIn: addDays(existing.checkIn, -1), checkOut: addDays(existing.checkOut, 1) },
        candidate,
      ),
    );

    if (!hasBufferOverlap) {
      intervals.push(candidate);
    }
  }

  return intervals.sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
}

function generateFloorBookings(blockedIntervals: DateInterval[]): DateInterval[] {
  const bookings: DateInterval[] = [];
  let cursor = WINDOW_START;
  let guard = 0;

  while (cursor < WINDOW_END && guard < 200) {
    guard++;
    cursor = addDays(cursor, randInt(0, 5));
    if (cursor >= WINDOW_END) break;

    const nights = randInt(2, 9);
    let checkOut = addDays(cursor, nights);
    if (checkOut > WINDOW_END) checkOut = WINDOW_END;
    if (daysBetween(cursor, checkOut) < 1) break;

    const candidate: DateInterval = { checkIn: cursor, checkOut };
    const blocker = blockedIntervals.find((interval) => overlaps(interval, candidate));

    if (blocker) {
      cursor = blocker.checkOut;
      continue;
    }

    bookings.push(candidate);
    cursor = checkOut;
  }

  return bookings;
}

function pickStatus(interval: DateInterval): ReservationStatus {
  if (interval.checkOut < NOW) {
    const r = Math.random();
    if (r < 0.08) return ReservationStatus.Cancelled;
    if (r < 0.16) return ReservationStatus.CheckedOut;
    return ReservationStatus.Completed;
  }

  if (interval.checkIn <= NOW && NOW <= interval.checkOut) {
    return chance(0.05) ? ReservationStatus.Cancelled : ReservationStatus.CheckedIn;
  }

  const r = Math.random();
  if (r < 0.08) return ReservationStatus.Cancelled;
  if (r < 0.6) return ReservationStatus.Confirmed;
  return ReservationStatus.Pending;
}

function generateReservationNumber(createdAt: Date, used: Set<string>): string {
  let value: string;
  do {
    const datePart = createdAt.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = randInt(0, 0xffffff).toString(16).toUpperCase().padStart(6, '0');
    value = `RES-${datePart}-${randomPart}`;
  } while (used.has(value));

  used.add(value);
  return value;
}

interface GeneratedPayment {
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
}

function generatePayments(
  status: ReservationStatus,
  totalPrice: number,
  checkIn: Date,
): GeneratedPayment[] {
  const methods = [PaymentMethod.Cash, PaymentMethod.BankTransfer, PaymentMethod.CreditCard];
  const firstPaymentDate = addDays(checkIn, -randInt(1, 30));
  const clampedFirstDate = firstPaymentDate > NOW ? NOW : firstPaymentDate;

  if (status === ReservationStatus.Pending || status === ReservationStatus.Cancelled) {
    if (chance(0.2)) {
      return [
        {
          amount: round2(totalPrice * randFloat(0.15, 0.3)),
          paymentMethod: pick(methods),
          paymentDate: clampedFirstDate,
        },
      ];
    }
    return [];
  }

  const settledBias =
    status === ReservationStatus.Completed || status === ReservationStatus.CheckedOut;
  const r = Math.random();

  if (settledBias ? r < 0.75 : r < 0.35) {
    return [{ amount: totalPrice, paymentMethod: pick(methods), paymentDate: clampedFirstDate }];
  }

  if (settledBias ? r < 0.9 : r < 0.55) {
    const first = round2(totalPrice * randFloat(0.4, 0.6));
    const secondDate = addDays(clampedFirstDate, randInt(1, 5));
    return [
      { amount: first, paymentMethod: pick(methods), paymentDate: clampedFirstDate },
      {
        amount: round2(totalPrice - first),
        paymentMethod: pick(methods),
        paymentDate: secondDate > NOW ? NOW : secondDate,
      },
    ];
  }

  if (r < 0.97) {
    return [
      {
        amount: round2(totalPrice * randFloat(0.3, 0.7)),
        paymentMethod: pick(methods),
        paymentDate: clampedFirstDate,
      },
    ];
  }

  return [
    {
      amount: round2(totalPrice * randFloat(1.02, 1.08)),
      paymentMethod: pick(methods),
      paymentDate: clampedFirstDate,
    },
  ];
}

async function seedReservationsForVilla(
  villaId: string,
  villaName: string,
  floors: FloorPlan[],
  customers: { id: string }[],
  usedReservationNumbers: Set<string>,
) {
  const groundFloor = floors[0];
  const upperFloor = floors[1];
  const entireFloor = floors[2];

  const entireIntervals = generateEntireVillaIntervals();
  const groundBookings = generateFloorBookings(entireIntervals);
  const upperBookings = generateFloorBookings(entireIntervals);

  const plan: { floor: FloorPlan; interval: DateInterval }[] = [
    ...entireIntervals.map((interval) => ({ floor: entireFloor, interval })),
    ...groundBookings.map((interval) => ({ floor: groundFloor, interval })),
    ...upperBookings.map((interval) => ({ floor: upperFloor, interval })),
  ];

  let reservationCount = 0;
  let paymentCount = 0;
  let housekeepingCount = 0;

  for (const { floor, interval } of plan) {
    const status = pickStatus(interval);
    const customer = pick(customers);
    const guestCount = randInt(1, floor.capacity);
    const nights = daysBetween(interval.checkIn, interval.checkOut);
    const totalPrice = round2(floor.dailyPrice * nights);
    const createdAt = addDays(interval.checkIn, -randInt(1, 45));
    const clampedCreatedAt = createdAt > NOW ? NOW : createdAt;

    const reservation = await prisma.reservation.create({
      data: {
        reservationNumber: generateReservationNumber(clampedCreatedAt, usedReservationNumbers),
        villaId,
        floorId: floor.id,
        customerId: customer.id,
        checkIn: interval.checkIn,
        checkOut: interval.checkOut,
        guestCount,
        totalPrice,
        status,
        notes: pick(RESERVATION_NOTES),
        createdAt: clampedCreatedAt,
      },
      select: { id: true },
    });
    reservationCount++;

    const payments = generatePayments(status, totalPrice, interval.checkIn);
    for (const payment of payments) {
      await prisma.payment.create({
        data: {
          reservationId: reservation.id,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paymentDate: payment.paymentDate,
        },
      });
      paymentCount++;
    }

    if (status === ReservationStatus.CheckedOut || status === ReservationStatus.Completed) {
      const startedAt = addDays(interval.checkOut, 0);
      startedAt.setHours(randInt(9, 16), randInt(0, 59));
      const clampedStartedAt = startedAt > NOW ? NOW : startedAt;

      if (status === ReservationStatus.Completed) {
        const completedAt = new Date(clampedStartedAt.getTime() + randInt(1, 4) * 60 * 60 * 1000);
        await prisma.housekeepingTask.create({
          data: {
            reservationId: reservation.id,
            villaId,
            status: HousekeepingStatus.Completed,
            startedAt: clampedStartedAt,
            completedAt: completedAt > NOW ? NOW : completedAt,
          },
        });
      } else {
        const inProgress = chance(0.5);
        await prisma.housekeepingTask.create({
          data: {
            reservationId: reservation.id,
            villaId,
            status: inProgress ? HousekeepingStatus.InProgress : HousekeepingStatus.Pending,
            startedAt: inProgress ? clampedStartedAt : null,
          },
        });
      }
      housekeepingCount++;
    }
  }

  console.log(
    `  Villa ${villaName}: ${reservationCount} reservations, ${paymentCount} payments, ${housekeepingCount} housekeeping tasks`,
  );
}

async function seedAdhocHousekeeping(villaId: string) {
  const count = randInt(1, 3);
  for (let i = 0; i < count; i++) {
    const openedAt = addDays(WINDOW_START, randInt(0, daysBetween(WINDOW_START, NOW)));
    const status = pick([
      HousekeepingStatus.Pending,
      HousekeepingStatus.InProgress,
      HousekeepingStatus.Completed,
    ]);

    await prisma.housekeepingTask.create({
      data: {
        villaId,
        status,
        notes: pick(ADHOC_HOUSEKEEPING_NOTES),
        startedAt: status === HousekeepingStatus.Pending ? null : openedAt,
        completedAt: status === HousekeepingStatus.Completed ? addDays(openedAt, 0) : null,
      },
    });
  }
}

async function seedMaintenanceRecords(villaId: string): Promise<string[]> {
  const count = randInt(3, 5);
  const usedTitles = new Set<string>();
  const recordIds: string[] = [];

  for (let i = 0; i < count; i++) {
    let item = pick(MAINTENANCE_ITEMS);
    let guard = 0;
    while (usedTitles.has(item.title) && guard < 10) {
      item = pick(MAINTENANCE_ITEMS);
      guard++;
    }
    usedTitles.add(item.title);

    const openedAt = addDays(WINDOW_START, randInt(0, daysBetween(WINDOW_START, NOW)));
    const isOld = daysBetween(openedAt, NOW) > 14;
    const status = isOld
      ? pick([
          MaintenanceStatus.Completed,
          MaintenanceStatus.Completed,
          MaintenanceStatus.Completed,
          MaintenanceStatus.Open,
        ])
      : pick([MaintenanceStatus.Open, MaintenanceStatus.InProgress, MaintenanceStatus.Completed]);

    const priority = pick([
      MaintenancePriority.Low,
      MaintenancePriority.Medium,
      MaintenancePriority.Medium,
      MaintenancePriority.High,
      MaintenancePriority.Urgent,
    ]);

    const record = await prisma.maintenanceRecord.create({
      data: {
        villaId,
        title: item.title,
        description: item.description,
        priority,
        status,
        openedAt,
        completedAt:
          status === MaintenanceStatus.Completed ? addDays(openedAt, randInt(0, 5)) : null,
      },
    });

    recordIds.push(record.id);
  }

  return recordIds;
}

/**
 * Villa-level running costs. Roughly two thirds of the maintenance jobs get a cost
 * attached, which is what makes the maintenance-to-expense link visible in the reports
 * without pretending every job was invoiced.
 */
async function seedExpensesForVilla(villaId: string, maintenanceRecordIds: string[]) {
  for (const item of VILLA_EXPENSE_ITEMS) {
    const occurrences = randInt(item.minCount, item.maxCount);
    for (let i = 0; i < occurrences; i++) {
      await prisma.expense.create({
        data: {
          villaId,
          category: item.category,
          description: item.description,
          supplier: item.supplier,
          amount: round2(randFloat(item.minAmount, item.maxAmount)),
          expenseDate: addDays(WINDOW_START, randInt(0, daysBetween(WINDOW_START, NOW))),
        },
      });
    }
  }

  for (const recordId of maintenanceRecordIds) {
    if (!chance(0.65)) continue;

    const record = await prisma.maintenanceRecord.findUniqueOrThrow({ where: { id: recordId } });
    await prisma.expense.create({
      data: {
        villaId,
        maintenanceRecordId: recordId,
        category: ExpenseCategory.Maintenance,
        description: record.title,
        supplier: pick(MAINTENANCE_SUPPLIERS),
        amount: round2(randFloat(800, 12000)),
        expenseDate: record.completedAt ?? record.openedAt,
      },
    });
  }
}

/** Overheads carried by the business, which is what `villaId: null` means. */
async function seedGeneralExpenses() {
  for (const item of GENERAL_EXPENSE_ITEMS) {
    const occurrences = randInt(item.minCount, item.maxCount);
    for (let i = 0; i < occurrences; i++) {
      await prisma.expense.create({
        data: {
          villaId: null,
          category: item.category,
          description: item.description,
          supplier: item.supplier,
          amount: round2(randFloat(item.minAmount, item.maxAmount)),
          expenseDate: addDays(WINDOW_START, randInt(0, daysBetween(WINDOW_START, NOW))),
        },
      });
    }
  }
}

async function seedMockData() {
  const existing = await prisma.villa.findFirst({ where: { name: 'Villa 1' } });
  if (existing) {
    console.log(
      'Mock villa data already present (villa "Villa 1" exists) — skipping mock data generation.',
    );
    return;
  }

  console.log(`Generating mock data across ${daysBetween(WINDOW_START, WINDOW_END)} days...`);

  const customers = await seedCustomers(55);
  const usedReservationNumbers = new Set<string>();

  for (let i = 0; i < VILLA_COUNT; i++) {
    const { villaId, villaName, floors } = await seedVillaWithFloors(i);
    await seedReservationsForVilla(villaId, villaName, floors, customers, usedReservationNumbers);
    await seedAdhocHousekeeping(villaId);
    const maintenanceRecordIds = await seedMaintenanceRecords(villaId);
    await seedExpensesForVilla(villaId, maintenanceRecordIds);
  }

  await seedGeneralExpenses();

  console.log(
    `Seeded ${VILLA_COUNT} villas with floors, a year of reservations, payments, housekeeping, maintenance records and expenses.`,
  );
}

async function main() {
  await seedAdmin();
  await seedMockData();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
