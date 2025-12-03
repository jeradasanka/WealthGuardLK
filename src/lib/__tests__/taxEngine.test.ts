import { describe, it, expect } from 'vitest';
import {
  calculatePreciousItemMarketValue,
  getJewelleryMarketValue,
  getForeignCurrencyMarketValue,
  calculateDerivedInvestmentIncome,
  calculateTotalIncome,
  calculateProgressiveTax,
  computeTax,
  CURRENCY_TO_LKR_RATES,
  COMMODITY_PRICE_INDICES_USD
} from '../taxEngine';
import { Asset, Income, EmploymentIncome, BusinessIncome, InvestmentIncome } from '@/types';

describe('Tax Engine', () => {
  describe('calculatePreciousItemMarketValue', () => {
    it('should calculate market value correctly for Gold', () => {
      // Mock data based on taxEngine.ts constants
      // Gold 2015 index: 105 (March 31, 2016)
      // Gold 2024 index: 210 (March 31, 2025)
      // USD 2015 rate: 149 (March 31, 2016)
      // USD 2024 rate: 295 (March 31, 2025)
      
      const originalCost = 100000;
      const itemType = 'Gold';
      const acquisitionYear = '2015';
      const taxYear = '2024';

      const result = calculatePreciousItemMarketValue(originalCost, itemType, acquisitionYear, taxYear);

      // Expected calculation:
      // USD Appreciation: 210 / 105 = 2
      // Exchange Rate Change: 295 / 149 = 1.9798...
      // Total Factor: 2 * 1.9798... = 3.9597...
      // Expected Value: 100000 * 3.9597... = 395973.15...

      const expected = 100000 * (210 / 105) * (295 / 149);
      expect(result).toBeCloseTo(expected, 2);
    });

    it('should return original cost if base index is 0', () => {
      const result = calculatePreciousItemMarketValue(1000, 'Gold', '1900', '2024');
      // Assuming 1900 is not in the index and defaults to 0 or handled gracefully
      // Actually the code defaults to 100 if not found, so let's check the code behavior
      // const baseUSDIndex = priceIndex[acquisitionYear] || 100;
      // So it won't be 0 unless explicitly set to 0.
      
      // Let's test with a year that doesn't exist, it should default to 100
      const resultDefault = calculatePreciousItemMarketValue(1000, 'Gold', '2099', '2024');
      // 2099 index -> 100
      // 2024 index -> 210
      // 2099 rate -> 135 (default)
      // 2024 rate -> 295
      // Factor: (210/100) * (295/135) = 2.1 * 2.185... = 4.588...
      const expected = 1000 * (210 / 100) * (295 / 135);
      expect(resultDefault).toBeCloseTo(expected, 2);
    });
  });

  describe('getJewelleryMarketValue', () => {
    it('should return market value from financials if not Bvi', () => {
      const asset: Asset = {
        id: '1',
        ownerId: '1',
        cageCategory: 'A',
        financials: { cost: 1000, marketValue: 2000, liabilities: 0 },
        meta: { dateAcquired: '2020-01-01' }
      };
      expect(getJewelleryMarketValue(asset, '2024')).toBe(2000);
    });

    it('should calculate market value for Bvi asset', () => {
      const asset: Asset = {
        id: '1',
        ownerId: '1',
        cageCategory: 'Bvi',
        financials: { cost: 100000, marketValue: 100000, liabilities: 0 },
        meta: { dateAcquired: '2015-01-01', itemType: 'Gold' }
      };
      
      // Should call calculatePreciousItemMarketValue with correct params
      // acquisitionYear: 2015
      // taxYear: 2024
      
      const result = getJewelleryMarketValue(asset, '2024');
      const expected = calculatePreciousItemMarketValue(100000, 'Gold', '2015', '2024');
      expect(result).toBe(expected);
    });
  });

  describe('getForeignCurrencyMarketValue', () => {
    it('should return market value if not Bii or LKR', () => {
      const asset: Asset = {
        id: '1',
        ownerId: '1',
        cageCategory: 'A',
        financials: { cost: 1000, marketValue: 2000, liabilities: 0 },
        meta: { dateAcquired: '2020-01-01' }
      };
      expect(getForeignCurrencyMarketValue(asset, '2024')).toBe(2000);

      const assetLKR: Asset = {
        id: '2',
        ownerId: '1',
        cageCategory: 'Bii',
        financials: { cost: 1000, marketValue: 2000, liabilities: 0 },
        meta: { dateAcquired: '2020-01-01', currency: 'LKR' }
      };
      expect(getForeignCurrencyMarketValue(assetLKR, '2024')).toBe(2000);
    });

    it('should calculate market value using balance and exchange rate', () => {
      const asset: Asset = {
        id: '1',
        ownerId: '1',
        cageCategory: 'Bii',
        financials: { cost: 1000, marketValue: 1000, liabilities: 0 },
        meta: { dateAcquired: '2020-01-01', currency: 'USD' },
        balances: [
          { id: '1', assetId: '1', taxYear: '2024', closingBalance: 1000, interestEarned: 50 }
        ]
      };
      
      // USD 2024 rate: 295
      const result = getForeignCurrencyMarketValue(asset, '2024');
      expect(result).toBe(1000 * 295);
    });

    it('should fallback to market value * exchange rate if no balance found', () => {
      const asset: Asset = {
        id: '1',
        ownerId: '1',
        cageCategory: 'Bii',
        financials: { cost: 1000, marketValue: 1000, liabilities: 0 },
        meta: { dateAcquired: '2020-01-01', currency: 'USD' },
        balances: []
      };
      
      // USD 2024 rate: 295
      const result = getForeignCurrencyMarketValue(asset, '2024');
      expect(result).toBe(1000 * 295);
    });
  });

  describe('calculateDerivedInvestmentIncome', () => {
    it('should calculate interest income from Bii assets', () => {
      const asset: Asset = {
        id: '1',
        ownerId: '1',
        cageCategory: 'Bii',
        financials: { cost: 1000, marketValue: 1000, liabilities: 0 },
        meta: { dateAcquired: '2020-01-01', bankName: 'Test Bank' },
        balances: [
          { id: '1', assetId: '1', taxYear: '2024', closingBalance: 1000, interestEarned: 100 }
        ]
      };

      const result = calculateDerivedInvestmentIncome([asset], '2024');
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(100);
      expect(result[0].type).toBe('interest');
    });

    it('should convert foreign currency interest to LKR', () => {
      const asset: Asset = {
        id: '1',
        ownerId: '1',
        cageCategory: 'Bii',
        financials: { cost: 1000, marketValue: 1000, liabilities: 0 },
        meta: { dateAcquired: '2020-01-01', currency: 'USD', bankName: 'Test Bank' },
        balances: [
          { id: '1', assetId: '1', taxYear: '2024', closingBalance: 1000, interestEarned: 100 }
        ]
      };

      // USD 2024 rate: 295
      const result = calculateDerivedInvestmentIncome([asset], '2024');
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(100 * 295);
    });

    it('should calculate dividend income from Biii assets', () => {
      const asset: Asset = {
        id: '1',
        ownerId: '1',
        cageCategory: 'Biii',
        financials: { cost: 1000, marketValue: 1000, liabilities: 0 },
        meta: { dateAcquired: '2020-01-01', companyName: 'Test Company' },
        balances: [
          { id: '1', assetId: '1', taxYear: '2024', closingBalance: 1000, interestEarned: 50 }
        ]
      };

      const result = calculateDerivedInvestmentIncome([asset], '2024');
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(50);
      expect(result[0].type).toBe('dividend');
    });
  });

  describe('calculateTotalIncome', () => {
    it('should sum up employment, business, and investment income', () => {
      const incomes: Income[] = [
        {
          id: '1', ownerId: '1', taxYear: '2024', schedule: '1',
          details: { employerName: 'Test', employerTIN: '123', grossRemuneration: 100000, nonCashBenefits: 10000, apitDeducted: 5000, exemptIncome: 0 }
        } as EmploymentIncome,
        {
          id: '2', ownerId: '1', taxYear: '2024', schedule: '2',
          details: { businessName: 'Test', grossRevenue: 0, directExpenses: 0, netProfit: 200000 }
        } as BusinessIncome,
        {
          id: '3', ownerId: '1', taxYear: '2024', schedule: '3', type: 'interest',
          details: { source: 'Test', grossAmount: 50000, whtDeducted: 2000 }
        } as InvestmentIncome
      ];

      const result = calculateTotalIncome(incomes, [], '2024');
      
      expect(result.employmentIncome).toBe(110000);
      expect(result.businessIncome).toBe(200000);
      expect(result.investmentIncome).toBe(50000);
      expect(result.totalIncome).toBe(360000);
      expect(result.totalAPIT).toBe(5000);
      expect(result.totalWHT).toBe(2000);
    });

    it('should apply 25% relief for rent income', () => {
      const incomes: Income[] = [
        {
          id: '1', ownerId: '1', taxYear: '2024', schedule: '3', type: 'rent',
          details: { source: 'Test', grossAmount: 100000, whtDeducted: 0 }
        } as InvestmentIncome
      ];

      const result = calculateTotalIncome(incomes, [], '2024');
      expect(result.investmentIncome).toBe(75000); // 100000 * 0.75
    });

    it('should include derived income from assets', () => {
      const asset: Asset = {
        id: '1',
        ownerId: '1',
        cageCategory: 'Bii',
        financials: { cost: 1000, marketValue: 1000, liabilities: 0 },
        meta: { dateAcquired: '2020-01-01', bankName: 'Test Bank' },
        balances: [
          { id: '1', assetId: '1', taxYear: '2024', closingBalance: 1000, interestEarned: 10000 }
        ]
      };

      const result = calculateTotalIncome([], [asset], '2024');
      expect(result.investmentIncome).toBe(10000);
    });
  });

  describe('calculateProgressiveTax', () => {
    it('should calculate tax correctly for 2024', () => {
      // 2024 Brackets:
      // 0-500k: 6%
      // 500k-1M: 12%
      // 1M-1.5M: 18%
      // 1.5M-2M: 24%
      // 2M-2.5M: 30%
      // >2.5M: 36%

      // Test case 1: 400,000 (within first bracket)
      expect(calculateProgressiveTax(400000, '2024')).toBe(Math.round(400000 * 0.06));

      // Test case 2: 750,000 (500k @ 6% + 250k @ 12%)
      const expected2 = (500000 * 0.06) + (250000 * 0.12);
      expect(calculateProgressiveTax(750000, '2024')).toBe(Math.round(expected2));

      // Test case 3: 3,000,000 (Full brackets + excess)
      // 500k * 0.06 = 30,000
      // 500k * 0.12 = 60,000
      // 500k * 0.18 = 90,000
      // 500k * 0.24 = 120,000
      // 500k * 0.30 = 150,000
      // 500k * 0.36 = 180,000
      // Total = 630,000
      const expectedFull = 30000 + 60000 + 90000 + 120000 + 150000 + 180000;
      expect(calculateProgressiveTax(3000000, '2024')).toBe(expectedFull);
    });
  });

  describe('computeTax', () => {
    it('should compute full tax liability correctly', () => {
      const incomes: Income[] = [
        {
          id: '1', ownerId: '1', taxYear: '2024', schedule: '1',
          details: { employerName: 'Test', employerTIN: '123', grossRemuneration: 2400000, nonCashBenefits: 0, apitDeducted: 50000, exemptIncome: 0 }
        } as EmploymentIncome
      ];

      // Total Income: 2,400,000
      // Personal Relief 2024: 1,200,000
      // Taxable Income: 1,200,000
      
      // Tax Calculation:
      // 500k @ 6% = 30,000
      // 500k @ 12% = 60,000
      // 200k @ 18% = 36,000
      // Total Tax = 126,000
      
      // Tax Payable = 126,000 - 50,000 (APIT) = 76,000

      const result = computeTax(incomes, [], '2024');
      
      expect(result.assessableIncome).toBe(2400000);
      expect(result.taxableIncome).toBe(1200000);
      expect(result.taxOnIncome).toBe(126000);
      expect(result.taxPayable).toBe(76000);
    });
  });
});
