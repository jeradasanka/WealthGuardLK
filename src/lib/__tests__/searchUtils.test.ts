import { describe, it, expect } from 'vitest';
import {
  filterBySearchTerm,
  searchCertificates,
  searchAssets,
  searchIncomes,
} from '@/utils/searchUtils';
import type { Asset, Income, AITWHTCertificate } from '@/types';

describe('Search Utilities', () => {
  describe('filterBySearchTerm', () => {
    const items = [
      { id: '1', title: 'Commercial Bank Savings', tag: 'Banking' },
      { id: '2', title: 'Sampath Bank Fixed Deposit', tag: 'Banking' },
      { id: '3', title: 'Toyota Aqua Vehicle', tag: 'Transport' },
    ];

    it('should return all items when query is empty', () => {
      expect(filterBySearchTerm(items, '', (i) => [i.title, i.tag])).toHaveLength(3);
      expect(filterBySearchTerm(items, '   ', (i) => [i.title, i.tag])).toHaveLength(3);
    });

    it('should match multiple space-separated tokens', () => {
      const result = filterBySearchTerm(items, 'bank fixed', (i) => [i.title, i.tag]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('should be case-insensitive', () => {
      const result = filterBySearchTerm(items, 'TOYOTA', (i) => [i.title, i.tag]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('3');
    });
  });

  describe('searchCertificates', () => {
    const certs: Partial<AITWHTCertificate>[] = [
      {
        id: 'cert-1',
        payerName: 'ABC Technologies PVT LTD',
        payerTIN: '102938475',
        certificateNumber: 'APIT-2024-001',
        type: 'employment',
        taxYear: '2024',
        details: { grossAmount: 500000, taxDeducted: 45000, netAmount: 455000 } as any,
      },
      {
        id: 'cert-2',
        payerName: 'Hatton National Bank',
        payerTIN: '987654321',
        certificateNumber: 'WHT-HNB-99',
        type: 'interest',
        taxYear: '2024',
        details: { grossAmount: 100000, taxDeducted: 5000, netAmount: 95000 } as any,
      },
    ];

    it('should match by payer name', () => {
      const results = searchCertificates(certs, 'Hatton');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('cert-2');
    });

    it('should match by certificate number', () => {
      const results = searchCertificates(certs, 'APIT-2024');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('cert-1');
    });

    it('should match by TIN', () => {
      const results = searchCertificates(certs, '102938475');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('cert-1');
    });
  });

  describe('searchAssets', () => {
    const assets: Partial<Asset>[] = [
      {
        id: 'asset-1',
        cageCategory: 'A',
        meta: {
          description: 'Residential House in Kandy',
          address: 'No 15, Peradeniya Road',
        } as any,
        financials: { cost: 15000000, marketValue: 20000000 },
      },
      {
        id: 'asset-2',
        cageCategory: 'Bii',
        meta: {
          description: 'Commercial Bank Savings Account',
          bankName: 'Commercial Bank',
          accountNo: '1000293848',
        } as any,
        financials: { cost: 500000, marketValue: 500000 },
      },
    ];

    it('should search by bank name and account number', () => {
      const results = searchAssets(assets as Asset[], 'commercial 1000293848');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('asset-2');
    });

    it('should search by address or description', () => {
      const results = searchAssets(assets as Asset[], 'kandy');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('asset-1');
    });
  });

  describe('searchIncomes', () => {
    const incomes: Partial<Income>[] = [
      {
        id: 'inc-1',
        schedule: '1',
        taxYear: '2024',
        details: {
          employerName: 'Virtusa Sri Lanka',
          employerTIN: '887766554',
          grossRemuneration: 1200000,
          apitDeducted: 100000,
        } as any,
      },
      {
        id: 'inc-2',
        schedule: '2',
        taxYear: '2024',
        details: {
          businessName: 'Lanka Agro Exports',
          grossRevenue: 5000000,
          directExpenses: 2000000,
          netProfit: 3000000,
        } as any,
      },
    ];

    it('should search by employer name or business name', () => {
      expect(searchIncomes(incomes as Income[], 'virtusa')).toHaveLength(1);
      expect(searchIncomes(incomes as Income[], 'agro exports')).toHaveLength(1);
    });

    it('should search by TIN', () => {
      expect(searchIncomes(incomes as Income[], '887766554')).toHaveLength(1);
    });
  });
});
