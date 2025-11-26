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

// Tax year configurations with personal relief and brackets
interface TaxYearConfig {
  personalRelief: number;
  brackets: { limit: number; rate: number }[];
}

const TAX_YEAR_CONFIGS: { [year: string]: TaxYearConfig } = {
  '2020': {
    personalRelief: 3000000, // Rs. 3,000,000
    brackets: [
      { limit: 0, rate: 0 },
      { limit: 3000000, rate: 0.06 },
      { limit: 6000000, rate: 0.12 },
      { limit: Infinity, rate: 0.18 },
    ],
  },
  '2021': {
    personalRelief: 3000000, // Rs. 3,000,000
    brackets: [
      { limit: 0, rate: 0 },
      { limit: 3000000, rate: 0.06 },
      { limit: 6000000, rate: 0.12 },
      { limit: Infinity, rate: 0.18 },
    ],
  },
  '2022': {
    // Split year - using average for simplicity, actual calculation needs period-based computation
    personalRelief: 1200000, // Simplified (actual: pro-rated)
    brackets: [
      { limit: 0, rate: 0 },
      { limit: 500000, rate: 0.06 },
      { limit: 1000000, rate: 0.12 },
      { limit: 1500000, rate: 0.18 },
      { limit: 2000000, rate: 0.24 },
      { limit: 2500000, rate: 0.30 },
      { limit: Infinity, rate: 0.36 },
    ],
  },
  '2023': {
    personalRelief: 1200000, // Rs. 1,200,000
    brackets: [
      { limit: 0, rate: 0 },
      { limit: 500000, rate: 0.06 },
      { limit: 1000000, rate: 0.12 },
      { limit: 1500000, rate: 0.18 },
      { limit: 2000000, rate: 0.24 },
      { limit: 2500000, rate: 0.30 },
      { limit: Infinity, rate: 0.36 },
    ],
  },
  '2024': {
    personalRelief: 1200000, // Rs. 1,200,000
    brackets: [
      { limit: 0, rate: 0 },
      { limit: 500000, rate: 0.06 },
      { limit: 1000000, rate: 0.12 },
      { limit: 1500000, rate: 0.18 },
      { limit: 2000000, rate: 0.24 },
      { limit: 2500000, rate: 0.30 },
      { limit: Infinity, rate: 0.36 },
    ],
  },
  '2025': {
    personalRelief: 1800000, // Rs. 1,800,000
    brackets: [
      { limit: 0, rate: 0 },
      { limit: 1000000, rate: 0.06 },
      { limit: 1500000, rate: 0.18 },
      { limit: 2000000, rate: 0.24 },
      { limit: 2500000, rate: 0.30 },
      { limit: Infinity, rate: 0.36 },
    ],
  },
};

const MAX_SOLAR_RELIEF = 600000; // Rs. 600,000

/**
 * Precious metals and gems price appreciation factors (2015-2025)
 * Based on historical market data and global commodity prices
 * Values represent cumulative appreciation from acquisition year to valuation year
 */
interface PriceIndexData {
  [year: string]: number; // Index value (2015 = 100)
}

const COMMODITY_PRICE_INDICES: { [itemType: string]: PriceIndexData } = {
  Gold: {
    '2015': 100,
    '2016': 108,
    '2017': 110,
    '2018': 107,
    '2019': 120,
    '2020': 155,
    '2021': 152,
    '2022': 160,
    '2023': 170,
    '2024': 190,
    '2025': 210,
  },
  Silver: {
    '2015': 100,
    '2016': 106,
    '2017': 111,
    '2018': 105,
    '2019': 115,
    '2020': 165,
    '2021': 158,
    '2022': 152,
    '2023': 160,
    '2024': 180,
    '2025': 195,
  },
  Gems: {
    '2015': 100,
    '2016': 105,
    '2017': 110,
    '2018': 115,
    '2019': 120,
    '2020': 125,
    '2021': 135,
    '2022': 145,
    '2023': 155,
    '2024': 170,
    '2025': 185,
  },
  Diamond: {
    '2015': 100,
    '2016': 103,
    '2017': 106,
    '2018': 108,
    '2019': 112,
    '2020': 110,
    '2021': 115,
    '2022': 120,
    '2023': 128,
    '2024': 140,
    '2025': 150,
  },
  Ruby: {
    '2015': 100,
    '2016': 108,
    '2017': 115,
    '2018': 120,
    '2019': 128,
    '2020': 135,
    '2021': 145,
    '2022': 155,
    '2023': 165,
    '2024': 180,
    '2025': 200,
  },
  Sapphire: {
    '2015': 100,
    '2016': 107,
    '2017': 113,
    '2018': 118,
    '2019': 125,
    '2020': 132,
    '2021': 142,
    '2022': 152,
    '2023': 162,
    '2024': 178,
    '2025': 195,
  },
  Jewellery: {
    '2015': 100,
    '2016': 107,
    '2017': 112,
    '2018': 110,
    '2019': 118,
    '2020': 145,
    '2021': 148,
    '2022': 155,
    '2023': 165,
    '2024': 185,
    '2025': 205,
  },
  Other: {
    '2015': 100,
    '2016': 105,
    '2017': 110,
    '2018': 112,
    '2019': 118,
    '2020': 130,
    '2021': 135,
    '2022': 142,
    '2023': 150,
    '2024': 165,
    '2025': 180,
  },
};

/**
 * Calculate market value for precious items based on acquisition year and current year
 * @param originalCost - Original purchase cost
 * @param itemType - Type of item (Gold, Silver, Gems, etc.)
 * @param acquisitionYear - Year item was acquired
 * @param valuationYear - Year for which to calculate market value
 * @returns Estimated market value
 */
export function calculatePreciousItemMarketValue(
  originalCost: number,
  itemType: string,
  acquisitionYear: string,
  valuationYear: string
): number {
  const priceIndex = COMMODITY_PRICE_INDICES[itemType] || COMMODITY_PRICE_INDICES['Other'];
  
  const baseIndex = priceIndex[acquisitionYear] || 100;
  const currentIndex = priceIndex[valuationYear] || priceIndex['2025'];
  
  if (baseIndex === 0) return originalCost;
  
  const appreciationFactor = currentIndex / baseIndex;
  return originalCost * appreciationFactor;
}

/**
 * Get tax configuration for a specific year
 */
export function getTaxConfig(taxYear: string): TaxYearConfig {
  const year = parseInt(taxYear);
  
  // Return config for the year, defaulting to 2024 if not found
  if (TAX_YEAR_CONFIGS[year.toString()]) {
    return TAX_YEAR_CONFIGS[year.toString()];
  }
  
  // For future years beyond 2025, use 2025 config
  if (year >= 2025) {
    return TAX_YEAR_CONFIGS['2025'];
  }
  
  // For years before 2020, use 2020 config
  return TAX_YEAR_CONFIGS['2020'];
}

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
 * Get the market value for a jewellery asset with automatic appreciation calculation
 * @param asset - The jewellery asset
 * @param taxYear - Tax year for valuation
 * @returns Market value for the given tax year
 */
export function getJewelleryMarketValue(asset: Asset, taxYear: string): number {
  if (asset.cageCategory !== 'Bvi') {
    return asset.financials.marketValue;
  }

  const itemType = asset.meta.itemType || 'Other';
  const acquisitionYear = asset.meta.dateAcquired.substring(0, 4); // Get year from YYYY-MM-DD
  const valuationYear = (parseInt(taxYear) + 1).toString(); // Tax year 2024 = valuation as of March 2025

  return calculatePreciousItemMarketValue(
    asset.financials.cost,
    itemType,
    acquisitionYear,
    valuationYear
  );
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
        employmentIncome += (emp.details.grossRemuneration || 0) + (emp.details.nonCashBenefits || 0);
        totalAPIT += (emp.details.apitDeducted || 0);
        break;
      }
      case '2': {
        const bus = income as BusinessIncome;
        businessIncome += (bus.details.netProfit || 0); // Cage 203
        break;
      }
      case '3': {
        const inv = income as InvestmentIncome;
        let incomeAmount = (inv.details.grossAmount || 0);
        
        // Apply 25% relief for rent income (FR-04)
        if (inv.type === 'rent') {
          const relief = incomeAmount * 0.25;
          incomeAmount -= relief;
        }
        
        investmentIncome += incomeAmount;
        totalWHT += (inv.details.whtDeducted || 0);
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
 * Calculates tax using progressive rates for a specific tax year (FR-09)
 */
export function calculateProgressiveTax(taxableIncome: number, taxYear: string = '2024'): number {
  const config = getTaxConfig(taxYear);
  let tax = 0;
  let previousLimit = 0;

  for (const bracket of config.brackets) {
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

  // Get tax configuration for the year
  const config = getTaxConfig(currentTaxYear);

  // Calculate reliefs
  const solarRelief = Math.min(solarInvestment, MAX_SOLAR_RELIEF);
  
  // Assessable Income = Total Income
  const assessableIncome = totalIncome;
  
  // Taxable Income = Assessable Income - Personal Relief - Solar Relief
  const taxableIncome = Math.max(
    0,
    assessableIncome - config.personalRelief - solarRelief
  );
  
  // Calculate tax on taxable income
  const taxOnIncome = calculateProgressiveTax(taxableIncome, currentTaxYear);
  
  // Tax Payable = Tax on Income - Tax Credits (APIT + WHT)
  const taxPayable = Math.max(
    0,
    taxOnIncome - totalAPIT - totalWHT
  );

  return {
    assessableIncome,
    reliefs: {
      personalRelief: config.personalRelief,
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
  const inflows = incomeBreakdown.totalIncome - ((incomeBreakdown.totalAPIT || 0) + (incomeBreakdown.totalWHT || 0)) + newLoans;
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
    taxDeducted: (incomeBreakdown.totalAPIT || 0) + (incomeBreakdown.totalWHT || 0),
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

/**
 * Returns the detailed tax breakdown by bracket
 */
export function getTaxBreakdown(taxableIncome: number, taxYear: string = '2024'): {
  range: string;
  rate: string;
  amount: number;
  tax: number;
}[] {
  const config = getTaxConfig(taxYear);
  let previousLimit = 0;
  const breakdown = [];

  // Filter out the 0-limit placeholder if it exists
  const activeBrackets = config.brackets.filter(b => b.limit > 0 || b.rate > 0);

  for (const bracket of activeBrackets) {
    if (taxableIncome <= previousLimit) break;

    const range = bracket.limit === Infinity ? Infinity : bracket.limit - previousLimit;
    const applicableIncome = Math.min(
      taxableIncome - previousLimit,
      range
    );

    const taxAmount = applicableIncome * bracket.rate;
    
    breakdown.push({
      range: bracket.limit === Infinity ? 'Balance' : `Next ${range.toLocaleString()}`,
      rate: `${(bracket.rate * 100).toFixed(0)}%`,
      amount: applicableIncome,
      tax: taxAmount
    });

    previousLimit = bracket.limit;
  }

  return breakdown;
}
