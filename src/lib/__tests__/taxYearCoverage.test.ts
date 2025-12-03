import { describe, it, expect } from 'vitest';
import { isDateInTaxYear, getTaxYearForDate } from '../taxYear';

describe('Tax Year Coverage Tests', () => {
  describe('isDateInTaxYear', () => {
    it('should handle Date object input', () => {
      const date = new Date(2024, 4, 1); // May 1, 2024
      expect(isDateInTaxYear(date, '2024')).toBe(true);
    });
  });

  describe('getTaxYearForDate', () => {
    it('should handle Date object input', () => {
      const date = new Date(2024, 4, 1); // May 1, 2024
      expect(getTaxYearForDate(date)).toBe('2024');
    });
  });
});
