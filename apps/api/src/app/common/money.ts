import { Prisma } from '../../generated/prisma/client';

/**
 * Money is stored as `Decimal(10, 2)`. Converting one such value to a JS number
 * is exact, so the API keeps returning numbers — but adding those numbers is
 * not: `0.1 + 0.2` is `0.30000000000000004`, and the error compounds over a
 * reservation's payments or a month of revenue. Every running total therefore
 * accumulates as Decimal and is converted once, at the end.
 */
export type MoneyInput = Prisma.Decimal | number | string;

export function sumMoney(values: readonly MoneyInput[]): number {
  return values
    .reduce<Prisma.Decimal>((total, value) => total.plus(value), new Prisma.Decimal(0))
    .toNumber();
}

export function addMoney(augend: MoneyInput, addend: MoneyInput): number {
  return new Prisma.Decimal(augend).plus(addend).toNumber();
}

export function subtractMoney(minuend: MoneyInput, subtrahend: MoneyInput): number {
  return new Prisma.Decimal(minuend).minus(subtrahend).toNumber();
}
