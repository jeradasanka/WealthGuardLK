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
 * Calculates total income from all schedules
 */
export function calculateTotalIncome(incomes: Income[]): {
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
  solarInvestment: number = 0
): TaxComputation {
  const {
    totalIncome,
    totalAPIT,
    totalWHT,
  } = calculateTotalIncome(incomes);

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
  // Calculate asset growth (assets acquired in current year)
  const assetGrowth = assets
    .filter((a) => a.meta.dateAcquired.startsWith(currentYear) && !a.disposed)
    .reduce((sum, a) => sum + a.financials.cost, 0);

  // Calculate new loans (liabilities in current year)
  const newLoans = liabilities
    .filter((l) => l.dateAcquired.startsWith(currentYear))
    .reduce((sum, l) => sum + l.originalAmount, 0);

  // Calculate declared income
  const { totalIncome } = calculateTotalIncome(
    incomes.filter((i) => i.taxYear === currentYear)
  );

  // Calculate risk score
  const outflows = assetGrowth + estimatedLivingExpenses;
  const inflows = totalIncome + newLoans;
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
    estimatedLivingExpenses,
    declaredIncome: totalIncome,
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
export function formatLKR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
