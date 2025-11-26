/**
 * Tax Calculation Engine
 * Implements Sri Lankan IRD tax computation logic
 * Covers FR-08, FR-09, and FR-10 from SRS
 */

import type {
  Income,
  EmploymentIncome,
  BusinessIncome,
  InvestmentIncome,
  TaxComputation,
  AuditRisk,
  Asset,
  Liability,
} from '@/types';
import { isDateInTaxYear } from './taxYear';

// Tax rates for progressive taxation (as of 2024/2025)
const TAX_BRACKETS = [
  { limit: 0, rate: 0 },
  { limit: 1200000, rate: 0 }, // Personal relief automatically applied
  { limit: 1700000, rate: 0.06 },
  { limit: 2200000, rate: 0.12 },
  { limit: 2700000, rate: 0.18 },
  { limit: 3200000, rate: 0.24 },
  { limit: 3700000, rate: 0.30 },
  { limit: Infinity, rate: 0.36 },
];

const PERSONAL_RELIEF = 1200000; // Rs. 1,200,000
const MAX_SOLAR_RELIEF = 600000; // Rs. 600,000

/**
 * Filter assets relevant to a specific tax year
 */
export function filterAssetsForTaxYear(assets: Asset[], taxYear: string): Asset[] {
  const taxYearStart = new Date(`${parseInt(taxYear)}-04-01`);
  const taxYearEnd = new Date(`${parseInt(taxYear) + 1}-03-31`);

  return assets.filter((asset) => {
    const acquiredDate = new Date(asset.meta.dateAcquired);
    
    if (acquiredDate > taxYearEnd) return false;
    
    if (asset.disposed && asset.disposed.date) {
      const disposedDate = new Date(asset.disposed.date);
      if (disposedDate < taxYearStart) return false;
    } else if (asset.disposed) {
      return false; // Disposed but no date, exclude
    }
    
    if (asset.closed && asset.closed.date) {
      const closedDate = new Date(asset.closed.date);
      if (closedDate < taxYearStart) return false;
    } else if (asset.closed) {
      return false; // Closed but no date, exclude
    }
    
    return true;
  });
}

/**
 * Calculate investment income derived from assets (Interest, Dividends)
 */
export function calculateDerivedInvestmentIncome(assets: Asset[], taxYear: string): { type: 'interest' | 'dividend' | 'rent'; amount: number; source: string; wht: number; ownerId: string }[] {
  const income: { type: 'interest' | 'dividend' | 'rent'; amount: number; source: string; wht: number; ownerId: string }[] = [];
  
  // We process all assets and check their balances for the specific tax year
  assets.forEach((asset) => {
    // Extract interest from bank accounts, cash, and loans given
    if ((asset.cageCategory === 'Bii' || asset.cageCategory === 'Biv' || asset.cageCategory === 'Bv') && asset.balances) {
      const yearBalance = asset.balances.find((b) => {
        // Match both "2024" and "2024/2025" formats
        return b.taxYear === taxYear || b.taxYear.startsWith(taxYear);
      });
      if (yearBalance && yearBalance.interestEarned > 0) {
        income.push({
          type: 'interest',
          amount: yearBalance.interestEarned,
          source: asset.meta.accountType ? `${asset.meta.bankName || 'Account'} - ${asset.meta.accountType}` : asset.meta.bankName || 'Interest Income',
          wht: 0, // WHT for interest is typically 0 for most deposits
          ownerId: asset.ownerId,
        });
      }
    }
    
    // Extract dividends from shares
    if (asset.cageCategory === 'Biii' && asset.balances) {
      const yearBalance = asset.balances.find((b) => {
        // Match both "2024" and "2024/2025" formats
        return b.taxYear === taxYear || b.taxYear.startsWith(taxYear);
      });
      if (yearBalance && yearBalance.interestEarned > 0) {
        income.push({
          type: 'dividend',
          amount: yearBalance.interestEarned,
          source: asset.meta.companyName || 'Dividend Income',
          wht: 0,
          ownerId: asset.ownerId,
        });
      }
    }
  });
  
  return income;
}

/**
 * Calculates total income from all schedules, including derived income from assets
 */
export function calculateTotalIncome(
  incomes: Income[], 
  assets: Asset[] = [], 
  currentTaxYear: string = '2024'
): {
  employmentIncome: number;
  businessIncome: number;
  investmentIncome: number;
  totalIncome: number;
  totalAPIT: number;
  totalWHT: number;
} {
  let employmentIncome = 0;
  let businessIncome = 0;
  let investmentIncome = 0;
  let totalAPIT = 0;
  let totalWHT = 0;

  // Process manual income entries
  incomes.forEach((income) => {
    switch (income.schedule) {
      case '1': {
        const emp = income as EmploymentIncome;
        employmentIncome += emp.details.grossRemuneration + emp.details.nonCashBenefits;
        totalAPIT += emp.details.apitDeducted;
        break;
      }
      case '2': {
        const bus = income as BusinessIncome;
        businessIncome += bus.details.netProfit; // Cage 203
        break;
      }
      case '3': {
        const inv = income as InvestmentIncome;
        let incomeAmount = inv.details.grossAmount;
        
        // Apply 25% relief for rent income (FR-04)
        if (inv.type === 'rent') {
          const relief = incomeAmount * 0.25;
          incomeAmount -= relief;
        }
        
        investmentIncome += incomeAmount;
        totalWHT += inv.details.whtDeducted;
        break;
      }
    }
  });

  // Process derived investment income from assets
  if (assets.length > 0) {
    const derivedIncomes = calculateDerivedInvestmentIncome(assets, currentTaxYear);
    derivedIncomes.forEach(inc => {
      investmentIncome += inc.amount;
      totalWHT += inc.wht;
    });
  }

  return {
    employmentIncome,
    businessIncome,
    investmentIncome,
    totalIncome: employmentIncome + businessIncome + investmentIncome,
    totalAPIT,
    totalWHT,
  };
}

/**
 * Calculates tax using progressive rates (FR-09)
 */
export function calculateProgressiveTax(taxableIncome: number): number {
  let tax = 0;
  let previousLimit = 0;

  for (const bracket of TAX_BRACKETS) {
    if (taxableIncome <= previousLimit) break;

    const applicableIncome = Math.min(
      taxableIncome - previousLimit,
      bracket.limit - previousLimit
    );

    tax += applicableIncome * bracket.rate;
    previousLimit = bracket.limit;
  }

  return Math.round(tax);
}

/**
 * Main tax computation function (FR-08, FR-09)
 */
export function computeTax(
  incomes: Income[],
  assets: Asset[] = [],
  currentTaxYear: string = '2024',
  solarInvestment: number = 0
): TaxComputation {
  const {
    totalIncome,
    totalAPIT,
    totalWHT,
  } = calculateTotalIncome(incomes, assets, currentTaxYear);

  // Calculate reliefs
  const solarRelief = Math.min(solarInvestment, MAX_SOLAR_RELIEF);
  
  // Assessable Income = Total Income
  const assessableIncome = totalIncome;
  
  // Taxable Income = Assessable Income - Personal Relief - Solar Relief
  const taxableIncome = Math.max(
    0,
    assessableIncome - PERSONAL_RELIEF - solarRelief
  );
  
  // Calculate tax on taxable income
  const taxOnIncome = calculateProgressiveTax(taxableIncome);
  
  // Tax Payable = Tax on Income - Tax Credits (APIT + WHT)
  const taxPayable = Math.max(
    0,
    taxOnIncome - totalAPIT - totalWHT
  );

  return {
    assessableIncome,
    reliefs: {
      personalRelief: PERSONAL_RELIEF,
      solarRelief,
    },
    taxableIncome,
    taxOnIncome,
    taxCredits: {
      apit: totalAPIT,
      wht: totalWHT,
    },
    taxPayable,
  };
}

/**
 * Calculates the Danger Meter / Audit Risk (FR-10)
 * Formula: Risk = (Asset Growth + Living Expenses) - (Declared Income + New Loans)
 */
export function calculateAuditRisk(
  assets: Asset[],
  liabilities: Liability[],
  incomes: Income[],
  currentYear: string,
  estimatedLivingExpenses: number = 0
): AuditRisk {
  // Calculate asset growth (assets acquired in current tax year)
  const assetGrowth = assets
    .filter((a) => isDateInTaxYear(a.meta.dateAcquired, currentYear) && !a.disposed)
    .reduce((sum, a) => sum + a.financials.cost, 0);

  // Calculate property expenses made in current tax year
  const propertyExpenses = assets
    .filter((a) => a.cageCategory === 'A' && a.propertyExpenses && a.propertyExpenses.length > 0)
    .reduce((sum, a) => {
      const yearExpenses = a.propertyExpenses!
        .filter((e) => e.taxYear === currentYear)
        .reduce((total, e) => total + e.amount, 0);
      return sum + yearExpenses;
    }, 0);

  // Calculate new loans (liabilities taken in current tax year)
  const newLoans = liabilities
    .filter((l) => isDateInTaxYear(l.dateAcquired, currentYear))
    .reduce((sum, l) => sum + l.originalAmount, 0);

  // Calculate loan payments made in current tax year (principal + interest)
  const loanPayments = liabilities.reduce((sum, l) => {
    if (!l.payments || l.payments.length === 0) return sum;
    
    const yearPayments = l.payments
      .filter(p => p.taxYear.toString() === currentYear)
      .reduce((total, p) => total + p.principalPaid + p.interestPaid, 0);
    
    return sum + yearPayments;
  }, 0);

  // Calculate declared income with breakdown
  const incomeBreakdown = calculateTotalIncome(
    incomes.filter((i) => i.taxYear === currentYear),
    assets,
    currentYear
  );

  // Calculate risk score (include property expenses in outflows, subtract tax already paid from inflows)
  const outflows = assetGrowth + propertyExpenses + estimatedLivingExpenses + loanPayments;
  const inflows = incomeBreakdown.totalIncome - (incomeBreakdown.totalAPIT + incomeBreakdown.totalWHT) + newLoans;
  const riskScore = outflows - inflows;

  // Determine risk level
  let riskLevel: 'safe' | 'warning' | 'danger' = 'safe';
  if (riskScore > 500000) {
    riskLevel = 'danger'; // More than Rs. 500,000 unexplained
  } else if (riskScore > 100000) {
    riskLevel = 'warning'; // More than Rs. 100,000 unexplained
  }

  return {
    assetGrowth,
    propertyExpenses,
    estimatedLivingExpenses,
    loanPayments,
    employmentIncome: incomeBreakdown.employmentIncome,
    businessIncome: incomeBreakdown.businessIncome,
    investmentIncome: incomeBreakdown.investmentIncome,
    totalIncome: incomeBreakdown.totalIncome,
    taxDeducted: incomeBreakdown.totalAPIT + incomeBreakdown.totalWHT,
    newLoans,
    riskScore,
    riskLevel,
  };
}

/**
 * Validates if asset's source of funds is complete (FR-07)
 */
export function validateSourceOfFunds(asset: Asset): {
  isValid: boolean;
  unexplainedAmount: number;
} {
  if (!asset.financials.sourceOfFunds) {
    return {
      isValid: false,
      unexplainedAmount: asset.financials.cost,
    };
  }

  const totalFunding = asset.financials.sourceOfFunds.reduce(
    (sum, source) => sum + source.amount,
    0
  );

  const unexplainedAmount = asset.financials.cost - totalFunding;

  return {
    isValid: unexplainedAmount <= 0,
    unexplainedAmount: Math.max(0, unexplainedAmount),
  };
}

/**
 * Formats Sri Lankan Rupees
 */
export function formatLKR(amount: number | undefined | null): string {
  const value = amount ?? 0;
  return `Rs. ${value.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
