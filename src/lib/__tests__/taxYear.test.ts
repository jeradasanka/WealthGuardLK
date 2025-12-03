import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  getCurrentTaxYear,
  formatTaxYear,
  getTaxYearDateRange,
  isDateInTaxYear,
  getTaxYearForDate,
  getRecentTaxYears,
  getTaxYearsFromStart
} from '../taxYear';

describe('Tax Year Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCurrentTaxYear', () => {
    it('should return previous year if date is Jan-Mar', () => {
      // Mock date to March 15, 2025
      const date = new Date(2025, 2, 15);
      vi.setSystemTime(date);
      expect(getCurrentTaxYear()).toBe('2024');
    });

    it('should return current year if date is Apr-Dec', () => {
      // Mock date to April 15, 2025
      const date = new Date(2025, 3, 15);
      vi.setSystemTime(date);
      expect(getCurrentTaxYear()).toBe('2025');
    });
  });

  describe('formatTaxYear', () => {
    it('should format tax year correctly', () => {
      expect(formatTaxYear('2024')).toBe('2024/2025');
    });
  });

  describe('getTaxYearDateRange', () => {
    it('should return correct date range', () => {
      const { start, end } = getTaxYearDateRange('2024');
      expect(start).toEqual(new Date(2024, 3, 1)); // April 1, 2024
      expect(end).toEqual(new Date(2025, 2, 31)); // March 31, 2025
    });
  });

  describe('isDateInTaxYear', () => {
    it('should return true if date is in tax year', () => {
      expect(isDateInTaxYear('2024-05-01', '2024')).toBe(true);
      expect(isDateInTaxYear('2025-02-01', '2024')).toBe(true);
    });

    it('should return false if date is not in tax year', () => {
      expect(isDateInTaxYear('2024-02-01', '2024')).toBe(false); // In 2023/2024
      expect(isDateInTaxYear('2025-05-01', '2024')).toBe(false); // In 2025/2026
    });
  });

  describe('getTaxYearForDate', () => {
    it('should return correct tax year for date', () => {
      expect(getTaxYearForDate('2024-05-01')).toBe('2024');
      expect(getTaxYearForDate('2025-02-01')).toBe('2024');
      expect(getTaxYearForDate('2024-02-01')).toBe('2023');
    });
  });

  describe('getRecentTaxYears', () => {
    it('should return recent tax years', () => {
      // Mock date to 2025
      const date = new Date(2025, 3, 15);
      vi.setSystemTime(date);
      
      const years = getRecentTaxYears(3);
      expect(years).toEqual(['2025', '2024', '2023']);
    });
  });

  describe('getTaxYearsFromStart', () => {
    it('should return tax years from start year', () => {
      // Mock date to 2025
      const date = new Date(2025, 3, 15);
      vi.setSystemTime(date);
      
      const years = getTaxYearsFromStart('2023');
      expect(years).toEqual(['2025', '2024', '2023']);
    });
  });
});
