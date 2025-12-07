/**
 * Tests for asset valuation functionality (IRD Cage A & Bi)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/stores/useStore';
import type { Asset, ValuationEntry } from '@/types';
import { getCurrentTaxYear } from '@/lib/taxYear';

describe('Asset Valuations', () => {
  beforeEach(() => {
    useStore.getState().resetState();
  });

  describe('ValuationEntry interface', () => {
    it('should create a valid valuation entry for Immovable Property (Cage A)', () => {
      const valuation: ValuationEntry = {
        id: 'val-1',
        taxYear: '2024',
        marketValue: 5000000,
        date: '2024-03-31',
        notes: 'Professional valuation by ABC Valuers',
      };

      expect(valuation.id).toBe('val-1');
      expect(valuation.taxYear).toBe('2024');
      expect(valuation.marketValue).toBe(5000000);
      expect(valuation.date).toBe('2024-03-31');
      expect(valuation.notes).toBe('Professional valuation by ABC Valuers');
    });

    it('should create a valid valuation entry for Motor Vehicle (Cage Bi)', () => {
      const valuation: ValuationEntry = {
        id: 'val-2',
        taxYear: '2023',
        marketValue: 3500000,
        date: '2023-12-15',
        notes: 'Market estimate based on comparable sales',
      };

      expect(valuation.id).toBe('val-2');
      expect(valuation.taxYear).toBe('2023');
      expect(valuation.marketValue).toBe(3500000);
    });
  });

  describe('Store actions for valuations', () => {
    it('should add valuation to asset', () => {
      const { addAsset, addValuationToAsset } = useStore.getState();

      // Create an Immovable Property asset (Cage A)
      const asset: Asset = {
        id: 'asset-1',
        ownerId: 'owner-1',
        cageCategory: 'A',
        meta: {
          description: 'House in Colombo',
          dateAcquired: '2020-01-01',
          address: '123 Main St, Colombo',
        },
        financials: {
          cost: 4000000,
          marketValue: 5000000,
        },
      };

      addAsset(asset);

      // Add a valuation
      const valuation: ValuationEntry = {
        id: 'val-1',
        taxYear: getCurrentTaxYear(),
        marketValue: 5500000,
        date: new Date().toISOString().split('T')[0],
        notes: 'Updated market valuation',
      };

      addValuationToAsset(asset.id, valuation);

      const updatedAsset = useStore.getState().assets.find(a => a.id === asset.id);
      expect(updatedAsset?.valuations).toHaveLength(1);
      expect(updatedAsset?.valuations?.[0]).toEqual(valuation);
    });

    it('should remove valuation from asset', () => {
      const { addAsset, addValuationToAsset, removeValuationFromAsset } = useStore.getState();

      const asset: Asset = {
        id: 'asset-2',
        ownerId: 'owner-1',
        cageCategory: 'Bi',
        meta: {
          description: 'Toyota Prius',
          dateAcquired: '2019-06-15',
          regNo: 'CAB-1234',
        },
        financials: {
          cost: 3000000,
          marketValue: 2500000,
        },
      };

      addAsset(asset);

      const valuation: ValuationEntry = {
        id: 'val-2',
        taxYear: '2023',
        marketValue: 2600000,
        date: '2023-12-31',
      };

      addValuationToAsset(asset.id, valuation);
      let updatedAsset = useStore.getState().assets.find(a => a.id === asset.id);
      expect(updatedAsset?.valuations).toHaveLength(1);

      removeValuationFromAsset(asset.id, valuation.id);
      updatedAsset = useStore.getState().assets.find(a => a.id === asset.id);
      expect(updatedAsset?.valuations).toHaveLength(0);
    });

    it('should update valuation in asset', () => {
      const { addAsset, addValuationToAsset, updateValuationInAsset } = useStore.getState();

      const asset: Asset = {
        id: 'asset-3',
        ownerId: 'owner-1',
        cageCategory: 'A',
        meta: {
          description: 'Land in Galle',
          dateAcquired: '2018-03-20',
          address: 'Beach Road, Galle',
        },
        financials: {
          cost: 2000000,
          marketValue: 3000000,
        },
      };

      addAsset(asset);

      const valuation: ValuationEntry = {
        id: 'val-3',
        taxYear: '2024',
        marketValue: 3200000,
        date: '2024-01-15',
        notes: 'Initial estimate',
      };

      addValuationToAsset(asset.id, valuation);

      const updates: Partial<ValuationEntry> = {
        marketValue: 3500000,
        notes: 'Revised valuation after professional assessment',
      };

      updateValuationInAsset(asset.id, valuation.id, updates);

      const updatedAsset = useStore.getState().assets.find(a => a.id === asset.id);
      expect(updatedAsset?.valuations?.[0].marketValue).toBe(3500000);
      expect(updatedAsset?.valuations?.[0].notes).toBe('Revised valuation after professional assessment');
    });

    it('should handle multiple valuations for different tax years', () => {
      const { addAsset, addValuationToAsset } = useStore.getState();

      const asset: Asset = {
        id: 'asset-4',
        ownerId: 'owner-1',
        cageCategory: 'A',
        meta: {
          description: 'Apartment in Kandy',
          dateAcquired: '2020-01-01',
        },
        financials: {
          cost: 6000000,
          marketValue: 7000000,
        },
      };

      addAsset(asset);

      // Add valuations for multiple years
      const valuation2022: ValuationEntry = {
        id: 'val-2022',
        taxYear: '2022',
        marketValue: 6500000,
        date: '2023-03-31',
      };

      const valuation2023: ValuationEntry = {
        id: 'val-2023',
        taxYear: '2023',
        marketValue: 7200000,
        date: '2024-03-31',
      };

      const valuation2024: ValuationEntry = {
        id: 'val-2024',
        taxYear: '2024',
        marketValue: 7800000,
        date: '2025-03-31',
      };

      addValuationToAsset(asset.id, valuation2022);
      addValuationToAsset(asset.id, valuation2023);
      addValuationToAsset(asset.id, valuation2024);

      const updatedAsset = useStore.getState().assets.find(a => a.id === asset.id);
      expect(updatedAsset?.valuations).toHaveLength(3);
      
      // Verify each valuation
      expect(updatedAsset?.valuations?.find(v => v.taxYear === '2022')?.marketValue).toBe(6500000);
      expect(updatedAsset?.valuations?.find(v => v.taxYear === '2023')?.marketValue).toBe(7200000);
      expect(updatedAsset?.valuations?.find(v => v.taxYear === '2024')?.marketValue).toBe(7800000);
    });
  });

  describe('Valuation persistence', () => {
    it('should maintain valuations when updating asset', () => {
      const { addAsset, addValuationToAsset, updateAsset } = useStore.getState();

      const asset: Asset = {
        id: 'asset-5',
        ownerId: 'owner-1',
        cageCategory: 'Bi',
        meta: {
          description: 'Honda Civic',
          dateAcquired: '2021-07-10',
          regNo: 'CAT-5678',
        },
        financials: {
          cost: 4500000,
          marketValue: 4000000,
        },
      };

      addAsset(asset);

      const valuation: ValuationEntry = {
        id: 'val-5',
        taxYear: '2024',
        marketValue: 4200000,
        date: '2024-06-30',
      };

      addValuationToAsset(asset.id, valuation);

      // Update other asset properties
      updateAsset(asset.id, {
        meta: {
          ...asset.meta,
          brand: 'Honda',
          model: 'Civic 2021',
        },
      });

      const updatedAsset = useStore.getState().assets.find(a => a.id === asset.id);
      expect(updatedAsset?.valuations).toHaveLength(1);
      expect(updatedAsset?.valuations?.[0]).toEqual(valuation);
      expect(updatedAsset?.meta.brand).toBe('Honda');
      expect(updatedAsset?.meta.model).toBe('Civic 2021');
    });
  });

  describe('Edge cases', () => {
    it('should handle asset with no valuations', () => {
      const { addAsset } = useStore.getState();

      const asset: Asset = {
        id: 'asset-6',
        ownerId: 'owner-1',
        cageCategory: 'A',
        meta: {
          description: 'New property',
          dateAcquired: '2024-01-01',
        },
        financials: {
          cost: 1000000,
          marketValue: 1000000,
        },
      };

      addAsset(asset);

      const retrievedAsset = useStore.getState().assets.find(a => a.id === asset.id);
      expect(retrievedAsset?.valuations).toBeUndefined();
    });

    it('should not affect assets of other cage categories', () => {
      const { addAsset, addValuationToAsset } = useStore.getState();

      // Create a Bank Balance asset (Cage Bii) - shouldn't have valuations
      const bankAsset: Asset = {
        id: 'asset-7',
        ownerId: 'owner-1',
        cageCategory: 'Bii',
        meta: {
          description: 'Savings Account',
          dateAcquired: '2020-01-01',
          bankName: 'Commercial Bank',
        },
        financials: {
          cost: 500000,
          marketValue: 500000,
        },
      };

      addAsset(bankAsset);

      const valuation: ValuationEntry = {
        id: 'val-7',
        taxYear: '2024',
        marketValue: 600000,
        date: '2024-03-31',
      };

      // This should work (store doesn't restrict by category)
      addValuationToAsset(bankAsset.id, valuation);

      const updatedAsset = useStore.getState().assets.find(a => a.id === bankAsset.id);
      // Even though Bii shouldn't typically have valuations, the store allows it
      // The UI should enforce the restriction
      expect(updatedAsset?.valuations).toHaveLength(1);
    });
  });
});
