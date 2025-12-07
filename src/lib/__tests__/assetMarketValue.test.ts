/**
 * Tests for getAssetMarketValue function with valuation support
 */

import { describe, it, expect } from 'vitest';
import { getAssetMarketValue } from '@/lib/taxEngine';
import type { Asset, ValuationEntry } from '@/types';

describe('getAssetMarketValue', () => {
  describe('Immovable Property (Cage A) with valuations', () => {
    it('should return valuation for exact tax year match', () => {
      const asset: Asset = {
        id: 'asset-1',
        ownerId: 'owner-1',
        cageCategory: 'A',
        meta: {
          description: 'House in Colombo',
          dateAcquired: '2020-01-01',
          address: '123 Main St',
        },
        financials: {
          cost: 4000000,
          marketValue: 5000000,
        },
        valuations: [
          {
            id: 'val-1',
            taxYear: '2023',
            marketValue: 5500000,
            date: '2024-03-31',
          },
          {
            id: 'val-2',
            taxYear: '2024',
            marketValue: 6000000,
            date: '2025-03-31',
          },
        ],
      };

      expect(getAssetMarketValue(asset, '2024')).toBe(6000000);
      expect(getAssetMarketValue(asset, '2023')).toBe(5500000);
    });

    it('should use most recent valuation when no exact match', () => {
      const asset: Asset = {
        id: 'asset-2',
        ownerId: 'owner-1',
        cageCategory: 'A',
        meta: {
          description: 'Land in Galle',
          dateAcquired: '2018-01-01',
        },
        financials: {
          cost: 2000000,
          marketValue: 3000000,
        },
        valuations: [
          {
            id: 'val-1',
            taxYear: '2022',
            marketValue: 2800000,
            date: '2023-03-31',
          },
          {
            id: 'val-2',
            taxYear: '2023',
            marketValue: 3200000,
            date: '2024-03-31',
          },
        ],
      };

      // For 2024, should use 2023 valuation (most recent up to that year)
      expect(getAssetMarketValue(asset, '2024')).toBe(3200000);
      expect(getAssetMarketValue(asset, '2025')).toBe(3200000);
    });

    it('should fallback to property expense market value if no valuations', () => {
      const asset: Asset = {
        id: 'asset-3',
        ownerId: 'owner-1',
        cageCategory: 'A',
        meta: {
          description: 'Apartment',
          dateAcquired: '2019-01-01',
        },
        financials: {
          cost: 3000000,
          marketValue: 3500000,
        },
        propertyExpenses: [
          {
            id: 'exp-1',
            taxYear: '2023',
            date: '2023-06-15',
            description: 'Renovation',
            expenseType: 'renovation',
            amount: 500000,
            marketValue: 4200000,
          },
        ],
      };

      expect(getAssetMarketValue(asset, '2023')).toBe(4200000);
      expect(getAssetMarketValue(asset, '2024')).toBe(4200000);
    });

    it('should prioritize valuations over property expenses', () => {
      const asset: Asset = {
        id: 'asset-4',
        ownerId: 'owner-1',
        cageCategory: 'A',
        meta: {
          description: 'House',
          dateAcquired: '2020-01-01',
        },
        financials: {
          cost: 5000000,
          marketValue: 6000000,
        },
        valuations: [
          {
            id: 'val-1',
            taxYear: '2024',
            marketValue: 7000000,
            date: '2025-03-31',
          },
        ],
        propertyExpenses: [
          {
            id: 'exp-1',
            taxYear: '2023',
            date: '2023-06-15',
            description: 'Repair',
            expenseType: 'repair',
            amount: 200000,
            marketValue: 6500000,
          },
        ],
      };

      // Should use valuation, not property expense
      expect(getAssetMarketValue(asset, '2024')).toBe(7000000);
    });
  });

  describe('Motor Vehicle (Cage Bi) with valuations', () => {
    it('should return valuation for vehicle', () => {
      const asset: Asset = {
        id: 'asset-5',
        ownerId: 'owner-1',
        cageCategory: 'Bi',
        meta: {
          description: 'Toyota Prius',
          dateAcquired: '2020-01-01',
          regNo: 'CAB-1234',
        },
        financials: {
          cost: 3500000,
          marketValue: 3000000,
        },
        valuations: [
          {
            id: 'val-1',
            taxYear: '2023',
            marketValue: 2800000,
            date: '2024-03-31',
          },
          {
            id: 'val-2',
            taxYear: '2024',
            marketValue: 2500000,
            date: '2025-03-31',
          },
        ],
      };

      expect(getAssetMarketValue(asset, '2024')).toBe(2500000);
      expect(getAssetMarketValue(asset, '2023')).toBe(2800000);
    });

    it('should use most recent valuation for future years', () => {
      const asset: Asset = {
        id: 'asset-6',
        ownerId: 'owner-1',
        cageCategory: 'Bi',
        meta: {
          description: 'Honda Civic',
          dateAcquired: '2021-01-01',
        },
        financials: {
          cost: 4000000,
          marketValue: 3800000,
        },
        valuations: [
          {
            id: 'val-1',
            taxYear: '2023',
            marketValue: 3500000,
            date: '2024-03-31',
          },
        ],
      };

      // For 2024 and beyond, should use 2023 valuation
      expect(getAssetMarketValue(asset, '2024')).toBe(3500000);
      expect(getAssetMarketValue(asset, '2025')).toBe(3500000);
    });

    it('should fallback to financials market value if no valuations', () => {
      const asset: Asset = {
        id: 'asset-7',
        ownerId: 'owner-1',
        cageCategory: 'Bi',
        meta: {
          description: 'Suzuki Alto',
          dateAcquired: '2022-01-01',
        },
        financials: {
          cost: 2000000,
          marketValue: 1800000,
        },
      };

      expect(getAssetMarketValue(asset, '2024')).toBe(1800000);
    });
  });

  describe('Stock Portfolio (Cage Biii)', () => {
    it('should return portfolio value from stock balance', () => {
      const asset: Asset = {
        id: 'asset-8',
        ownerId: 'owner-1',
        cageCategory: 'Biii',
        meta: {
          description: 'Stock Portfolio',
          dateAcquired: '2020-01-01',
          cdsAccountNo: '12345678',
        },
        financials: {
          cost: 1000000,
          marketValue: 1200000,
        },
        stockBalances: [
          {
            id: 'sb-1',
            taxYear: '2023',
            brokerCashBalance: 50000,
            cashTransfers: 200000,
            portfolioValue: 1500000,
            holdings: [],
            purchases: 200000,
            dividends: 50000,
          },
        ],
      };

      expect(getAssetMarketValue(asset, '2023')).toBe(1500000);
      expect(getAssetMarketValue(asset, '2024')).toBe(1500000);
    });
  });

  describe('Assets without special valuations', () => {
    it('should return market value for Cash (Biv)', () => {
      const asset: Asset = {
        id: 'asset-9',
        ownerId: 'owner-1',
        cageCategory: 'Biv',
        meta: {
          description: 'Cash in hand',
          dateAcquired: '2020-01-01',
        },
        financials: {
          cost: 500000,
          marketValue: 500000,
        },
      };

      expect(getAssetMarketValue(asset, '2024')).toBe(500000);
    });

    it('should return market value for Business Property (C)', () => {
      const asset: Asset = {
        id: 'asset-10',
        ownerId: 'owner-1',
        cageCategory: 'C',
        meta: {
          description: 'Shop building',
          dateAcquired: '2018-01-01',
        },
        financials: {
          cost: 8000000,
          marketValue: 10000000,
        },
      };

      expect(getAssetMarketValue(asset, '2024')).toBe(10000000);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero market value valuation', () => {
      const asset: Asset = {
        id: 'asset-11',
        ownerId: 'owner-1',
        cageCategory: 'A',
        meta: {
          description: 'Property',
          dateAcquired: '2020-01-01',
        },
        financials: {
          cost: 3000000,
          marketValue: 3500000,
        },
        valuations: [
          {
            id: 'val-1',
            taxYear: '2024',
            marketValue: 0,
            date: '2025-03-31',
          },
        ],
      };

      // Should fallback to financial market value when valuation is 0
      expect(getAssetMarketValue(asset, '2024')).toBe(3500000);
    });

    it('should handle empty valuations array', () => {
      const asset: Asset = {
        id: 'asset-12',
        ownerId: 'owner-1',
        cageCategory: 'A',
        meta: {
          description: 'Land',
          dateAcquired: '2021-01-01',
        },
        financials: {
          cost: 2000000,
          marketValue: 2500000,
        },
        valuations: [],
      };

      expect(getAssetMarketValue(asset, '2024')).toBe(2500000);
    });

    it('should not use valuations from future years', () => {
      const asset: Asset = {
        id: 'asset-13',
        ownerId: 'owner-1',
        cageCategory: 'A',
        meta: {
          description: 'Property',
          dateAcquired: '2020-01-01',
        },
        financials: {
          cost: 4000000,
          marketValue: 5000000,
        },
        valuations: [
          {
            id: 'val-1',
            taxYear: '2025',
            marketValue: 6000000,
            date: '2026-03-31',
          },
        ],
      };

      // For 2024, should not use 2025 valuation
      expect(getAssetMarketValue(asset, '2024')).toBe(5000000);
    });
  });
});
