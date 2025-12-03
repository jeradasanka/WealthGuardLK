import { describe, it, expect } from 'vitest';
import { filterAssetsForTaxYear } from '../taxEngine';
import { Asset } from '../../types';

describe('filterAssetsForTaxYear', () => {
  const taxYear = '2024'; // Tax year 2024/2025: 2024-04-01 to 2025-03-31
  
  const createAsset = (
    id: string, 
    dateAcquired: string, 
    disposed?: { date: string; salePrice: number },
    closed?: { date: string; finalBalance: number }
  ): Asset => ({
    id,
    ownerId: 'owner1',
    cageCategory: 'A',
    meta: {
      description: 'Test Asset',
      dateAcquired,
    },
    financials: {
      cost: 1000,
      marketValue: 1000,
    },
    disposed,
    closed,
  });

  it('should include asset acquired before tax year and active throughout', () => {
    const asset = createAsset('1', '2020-01-01');
    const result = filterAssetsForTaxYear([asset], taxYear);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should include asset acquired during tax year', () => {
    const asset = createAsset('2', '2024-06-01');
    const result = filterAssetsForTaxYear([asset], taxYear);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('should exclude asset acquired after tax year end', () => {
    const asset = createAsset('3', '2025-04-01');
    const result = filterAssetsForTaxYear([asset], taxYear);
    expect(result).toHaveLength(0);
  });

  it('should exclude asset disposed before tax year start', () => {
    const asset = createAsset('4', '2020-01-01', { date: '2024-03-31', salePrice: 1000 });
    const result = filterAssetsForTaxYear([asset], taxYear);
    expect(result).toHaveLength(0);
  });

  it('should include asset disposed during tax year', () => {
    const asset = createAsset('5', '2020-01-01', { date: '2024-06-01', salePrice: 1000 });
    const result = filterAssetsForTaxYear([asset], taxYear);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('5');
  });

  it('should include asset disposed after tax year end', () => {
    const asset = createAsset('6', '2020-01-01', { date: '2025-04-01', salePrice: 1000 });
    const result = filterAssetsForTaxYear([asset], taxYear);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('6');
  });

  it('should exclude asset disposed but with no date (invalid state)', () => {
    // @ts-ignore - Testing invalid state where date is missing but object exists
    const asset = createAsset('7', '2020-01-01', { salePrice: 1000 });
    const result = filterAssetsForTaxYear([asset], taxYear);
    expect(result).toHaveLength(0);
  });

  it('should exclude asset closed before tax year start', () => {
    const asset = createAsset('8', '2020-01-01', undefined, { date: '2024-03-31', finalBalance: 0 });
    const result = filterAssetsForTaxYear([asset], taxYear);
    expect(result).toHaveLength(0);
  });

  it('should include asset closed during tax year', () => {
    const asset = createAsset('9', '2020-01-01', undefined, { date: '2024-06-01', finalBalance: 0 });
    const result = filterAssetsForTaxYear([asset], taxYear);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('9');
  });

  it('should include asset closed after tax year end', () => {
    const asset = createAsset('10', '2020-01-01', undefined, { date: '2025-04-01', finalBalance: 0 });
    const result = filterAssetsForTaxYear([asset], taxYear);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('10');
  });

  it('should exclude asset closed but with no date (invalid state)', () => {
    // @ts-ignore - Testing invalid state where date is missing but object exists
    const asset = createAsset('11', '2020-01-01', undefined, { finalBalance: 0 });
    const result = filterAssetsForTaxYear([asset], taxYear);
    expect(result).toHaveLength(0);
  });
});
