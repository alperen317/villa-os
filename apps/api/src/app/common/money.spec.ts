import { addMoney, subtractMoney, sumMoney } from './money';
import { Prisma } from '../../generated/prisma/client';

describe('money', () => {
  describe('sumMoney', () => {
    it('adds fractional amounts without float drift', () => {
      // Plain JS gives 0.30000000000000004 here.
      expect(sumMoney([0.1, 0.2])).toBe(0.3);
    });

    it('stays exact across many small amounts', () => {
      expect(sumMoney(Array.from({ length: 100 }, () => 0.01))).toBe(1);
    });

    it('accepts Decimal and string inputs alongside numbers', () => {
      expect(sumMoney([new Prisma.Decimal('10.05'), '20.10', 30.15])).toBe(60.3);
    });

    it('treats an empty list as zero', () => {
      expect(sumMoney([])).toBe(0);
    });
  });

  describe('addMoney', () => {
    it('adds without float drift', () => {
      expect(addMoney(0.1, 0.2)).toBe(0.3);
    });
  });

  describe('subtractMoney', () => {
    it('subtracts without float drift', () => {
      // Plain JS gives 0.009999999999990905 here.
      expect(subtractMoney(1000, 999.99)).toBe(0.01);
    });

    it('goes negative on overpayment', () => {
      expect(subtractMoney(100, 150.5)).toBe(-50.5);
    });
  });
});
