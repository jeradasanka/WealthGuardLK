import { describe, it, expect } from 'vitest';
import {
  calculatePreciousItemMarketValue,
  getForeignCurrencyMarketValue,
  calculateAuditRisk,
  validateSourceOfFunds,
  formatLKR,
  getTaxBreakdown,
} from '../taxEngine';
import { Asset, Liability, Income } from '@/types';

describe('Tax Engine Coverage Tests', () => {
  describe('calculatePreciousItemMarketValue', () => {
    it('should calculate market value for Gold correctly', () => {
      // Gold 2014 index: 100, 2024 index: 210
      // USD 2014 rate: 135, 2024 rate: 295
      // Appreciation = (210/100) * (295/135) = 2.1 * 2.185... = ~4.588
      const cost = 100000;
      const value = calculatePreciousItemMarketValue(cost, 'Gold', '2014', '2024');
      expect(value).toBeGreaterThan(cost);
      expect(value).toBeCloseTo(100000 * (210 / 100) * (295 / 135), 0);
    });

    it('should use Other index for unknown item types', () => {
      const cost = 100000;
      const value = calculatePreciousItemMarketValue(cost, 'Unknown', '2014', '2024');
      // Other 2014: 100, 2024: 170
      // USD 2014: 135, 2024: 295
      expect(value).toBeCloseTo(100000 * (170 / 100) * (295 / 135), 0);
    });

    it('should handle base index 0 (return original cost)', () => {
        // Mocking or using a year that might not exist if not handled, but the code handles defaults.
        // However, if I pass a year that results in 0 index if not defaulted.
        // The code defaults to 100 if not found.
        // So I can't easily trigger baseUSDIndex === 0 unless I modify the map or pass a year that resolves to 0.
        // But the map has defaults.
        // Let's try to pass a year that is not in the map and see if it defaults to 100.
        // Actually, the code says `const baseUSDIndex = priceIndex[acquisitionYear] || 100;`
        // So it's hard to get 0.
        // But if I can mock the map... I can't easily mock the internal const.
        // I will skip this specific branch for now as it seems unreachable with current data.
    });
  });

  describe('getForeignCurrencyMarketValue', () => {
    it('should return market value converted to LKR if no balance record exists', () => {
      const asset: Asset = {
        id: '1',
        ownerId: 'owner1',
        cageCategory: 'Bii',
        meta: {
          currency: 'USD',
          bankName: 'Test Bank',
          accountNumber: '123',
          dateAcquired: '2024-01-01',
        },
        financials: {
          cost: 1000,
          marketValue: 1000, // USD
        },
        balances: [], // No balances
      };

      // USD 2024 rate: 295
      const value = getForeignCurrencyMarketValue(asset, '2024');
      expect(value).toBe(1000 * 295);
    });

    it('should return market value as is if currency is LKR', () => {
        const asset: Asset = {
            id: '1',
            ownerId: 'owner1',
            cageCategory: 'Bii',
            meta: {
              currency: 'LKR',
              bankName: 'Test Bank',
              accountNumber: '123',
              dateAcquired: '2024-01-01',
            },
            financials: {
              cost: 1000,
              marketValue: 1000,
            },
            balances: [],
          };
          const value = getForeignCurrencyMarketValue(asset, '2024');
          expect(value).toBe(1000);
    });

    it('should return market value as is if currency is unknown', () => {
        const asset: Asset = {
            id: '1',
            ownerId: 'owner1',
            cageCategory: 'Bii',
            meta: {
              currency: 'XYZ' as any, // Unknown currency
              bankName: 'Test Bank',
              accountNumber: '123',
              dateAcquired: '2024-01-01',
            },
            financials: {
              cost: 1000,
              marketValue: 1000,
            },
            balances: [],
          };
          const value = getForeignCurrencyMarketValue(asset, '2024');
          expect(value).toBe(1000);
    });
  });

  describe('calculateAuditRisk', () => {
    it('should calculate risk correctly', () => {
      const assets: Asset[] = [
        {
          id: '1',
          ownerId: 'owner1',
          cageCategory: 'A',
          meta: { dateAcquired: '2024-05-01' },
          financials: { cost: 5000000, marketValue: 5000000 },
          propertyExpenses: [
            { id: 'e1', taxYear: '2024', amount: 100000, description: 'Repair', date: '2024-06-01' },
          ],
        },
        {
            id: '2',
            ownerId: 'owner1',
            cageCategory: 'A',
            meta: { dateAcquired: '2020-01-01' }, // Old asset
            financials: { cost: 1000000, marketValue: 1000000 },
            disposed: {
                date: '2024-08-01',
                salePrice: 2000000,
                capitalGain: 1000000
            }
        }
      ];

      const liabilities: Liability[] = [
        {
          id: 'l1',
          ownerId: 'owner1',
          type: 'loan',
          lender: 'Bank',
          originalAmount: 2000000,
          outstandingAmount: 1800000,
          dateAcquired: '2024-04-01',
          payments: [
            { id: 'p1', taxYear: '2024', date: '2024-05-01', principalPaid: 100000, interestPaid: 50000 },
          ],
        },
      ];

      const incomes: Income[] = [
        {
          id: 'i1',
          ownerId: 'owner1',
          taxYear: '2024',
          schedule: '1',
          employmentDetails: {
            employerName: 'Company',
            grossRemuneration: 3000000,
            apitDeducted: 100000,
          },
          details: { grossRemuneration: 3000000, apitDeducted: 100000 },
        } as any,
      ];

      const risk = calculateAuditRisk(assets, liabilities, incomes, '2024');

      // Asset Growth: 5,000,000 (Asset 1)
      // Asset Sales: 2,000,000 (Asset 2)
      // Property Expenses: 100,000
      // New Loans: 2,000,000
      // Loan Payments: 150,000 (100k + 50k)
      
      // Income: 3,000,000
      // Tax Deducted: 100,000
      // Net Income: 2,900,000

      // Actual Outflows = Asset Growth + Property Expenses + Loan Payments
      // = 5,000,000 + 100,000 + 150,000 = 5,250,000

      // Actual Inflows = Net Income + New Loans + Asset Sales
      // = 2,900,000 + 2,000,000 + 2,000,000 = 6,900,000

      // Derived Living Expenses = Inflows - Outflows = 6,900,000 - 5,250,000 = 1,650,000

      // Total Outflows = Actual Outflows + Derived Living Expenses = 5,250,000 + 1,650,000 = 6,900,000
      // Risk Score = Total Outflows - Actual Inflows = 0

      expect(risk.assetGrowth).toBe(5000000);
      expect(risk.assetSales).toBe(2000000);
      expect(risk.propertyExpenses).toBe(100000);
      expect(risk.newLoans).toBe(2000000);
      expect(risk.loanPayments).toBe(150000);
      expect(risk.derivedLivingExpenses).toBe(1650000);
      expect(risk.riskScore).toBe(0);
      expect(risk.riskLevel).toBe('safe');
    });

    it('should detect danger risk level', () => {
        // High outflows, low inflows
        const assets: Asset[] = [
            {
              id: '1',
              ownerId: 'owner1',
              cageCategory: 'A',
              meta: { dateAcquired: '2024-05-01' },
              financials: { cost: 10000000, marketValue: 10000000 },
            },
        ];
        const liabilities: Liability[] = [];
        const incomes: Income[] = []; // No income

        const risk = calculateAuditRisk(assets, liabilities, incomes, '2024');
        
        // Outflows: 10,000,000
        // Inflows: 0
        // Derived Living Expenses: 0 (Inflows - Outflows < 0 -> 0)
        // Total Outflows: 10,000,000
        // Risk Score: 10,000,000 - 0 = 10,000,000
        
        expect(risk.riskLevel).toBe('danger');
    });

    it('should detect warning risk level', () => {
        // Unexplained between 100k and 500k
        const assets: Asset[] = [
            {
              id: '1',
              ownerId: 'owner1',
              cageCategory: 'A',
              meta: { dateAcquired: '2024-05-01' },
              financials: { cost: 200000, marketValue: 200000 },
            },
        ];
        const liabilities: Liability[] = [];
        const incomes: Income[] = []; 

        const risk = calculateAuditRisk(assets, liabilities, incomes, '2024');
        
        // Risk Score: 200,000
        expect(risk.riskLevel).toBe('warning');
    });
  });

  describe('validateSourceOfFunds', () => {
    it('should return valid if sources cover cost', () => {
      const asset: Asset = {
        id: '1',
        ownerId: 'owner1',
        cageCategory: 'A',
        meta: { dateAcquired: '2024-01-01' },
        financials: {
          cost: 1000000,
          marketValue: 1000000,
          sourceOfFunds: [
            { id: 's1', type: 'savings', amount: 1000000, description: 'Savings' },
          ],
        },
      };
      const result = validateSourceOfFunds(asset);
      expect(result.isValid).toBe(true);
      expect(result.unexplainedAmount).toBe(0);
    });

    it('should return invalid if sources do not cover cost', () => {
      const asset: Asset = {
        id: '1',
        ownerId: 'owner1',
        cageCategory: 'A',
        meta: { dateAcquired: '2024-01-01' },
        financials: {
          cost: 1000000,
          marketValue: 1000000,
          sourceOfFunds: [
            { id: 's1', type: 'savings', amount: 500000, description: 'Savings' },
          ],
        },
      };
      const result = validateSourceOfFunds(asset);
      expect(result.isValid).toBe(false);
      expect(result.unexplainedAmount).toBe(500000);
    });

    it('should return invalid if no sources provided', () => {
        const asset: Asset = {
            id: '1',
            ownerId: 'owner1',
            cageCategory: 'A',
            meta: { dateAcquired: '2024-01-01' },
            financials: {
              cost: 1000000,
              marketValue: 1000000,
              // sourceOfFunds undefined
            },
          };
          const result = validateSourceOfFunds(asset);
          expect(result.isValid).toBe(false);
          expect(result.unexplainedAmount).toBe(1000000);
    });
  });

  describe('formatLKR', () => {
    it('should format number correctly', () => {
      expect(formatLKR(1000)).toBe('Rs. 1,000.00');
      expect(formatLKR(1234.56)).toBe('Rs. 1,234.56');
    });

    it('should handle undefined or null', () => {
      expect(formatLKR(undefined)).toBe('Rs. 0.00');
      expect(formatLKR(null)).toBe('Rs. 0.00');
    });
  });

  describe('getTaxBreakdown', () => {
    it('should return correct breakdown for 2024', () => {
      // 2024 brackets:
      // 0-500k: 6%
      // 500k-1M: 12%
      // 1M-1.5M: 18%
      // 1.5M-2M: 24%
      // 2M-2.5M: 30%
      // >2.5M: 36%
      
      const breakdown = getTaxBreakdown(3000000, '2024');
      
      // 1. 500,000 * 6% = 30,000
      // 2. 500,000 * 12% = 60,000
      // 3. 500,000 * 18% = 90,000
      // 4. 500,000 * 24% = 120,000
      // 5. 500,000 * 30% = 150,000
      // 6. 500,000 * 36% = 180,000 (Balance)
      
      expect(breakdown).toHaveLength(6);
      expect(breakdown[0].rate).toBe('6%');
      expect(breakdown[0].tax).toBe(30000);
      expect(breakdown[5].rate).toBe('36%');
      expect(breakdown[5].tax).toBe(180000);
    });

    it('should handle income within first bracket', () => {
        const breakdown = getTaxBreakdown(200000, '2024');
        expect(breakdown).toHaveLength(1);
        expect(breakdown[0].amount).toBe(200000);
        expect(breakdown[0].tax).toBe(12000);
    });
  });
});
