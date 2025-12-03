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
 * USD to LKR exchange rate indices (2015-2025)
 * Based on historical Central Bank of Sri Lanka data
 * Index represents the exchange rate (1 USD = X LKR)
 */
const CURRENCY_TO_LKR_RATES: { [currency: string]: { [year: string]: number } } = {
  USD: {
    '2015': 135,
    '2016': 149,
    '2017': 153,
    '2018': 162,
    '2019': 178,
    '2020': 185,
    '2021': 200,
    '2022': 360,
    '2023': 325,
    '2024': 300,
    '2025': 295,
  },
  EUR: {
    '2015': 150,
    '2016': 165,
    '2017': 180,
    '2018': 190,
    '2019': 200,
    '2020': 210,
    '2021': 235,
    '2022': 380,
    '2023': 350,
    '2024': 330,
    '2025': 325,
  },
  GBP: {
    '2015': 205,
    '2016': 200,
    '2017': 210,
    '2018': 220,
    '2019': 230,
    '2020': 240,
    '2021': 270,
    '2022': 435,
    '2023': 405,
    '2024': 385,
    '2025': 378,
  },
  AUD: {
    '2015': 100,
    '2016': 110,
    '2017': 118,
    '2018': 120,
    '2019': 125,
    '2020': 128,
    '2021': 148,
    '2022': 250,
    '2023': 215,
    '2024': 200,
    '2025': 195,
  },
  CAD: {
    '2015': 105,
    '2016': 112,
    '2017': 120,
    '2018': 125,
    '2019': 135,
    '2020': 140,
    '2021': 160,
    '2022': 280,
    '2023': 245,
    '2024': 225,
    '2025': 218,
  },
  JPY: {
    '2015': 1.15,
    '2016': 1.35,
    '2017': 1.38,
    '2018': 1.48,
    '2019': 1.65,
    '2020': 1.75,
    '2021': 1.75,
    '2022': 2.75,
    '2023': 2.30,
    '2024': 2.05,
    '2025': 2.00,
  },
  CNY: {
    '2015': 21,
    '2016': 22,
    '2017': 23,
    '2018': 24,
    '2019': 26,
    '2020': 27,
    '2021': 31,
    '2022': 54,
    '2023': 45,
    '2024': 42,
    '2025': 41,
  },
  INR: {
    '2015': 2.10,
    '2016': 2.25,
    '2017': 2.35,
    '2018': 2.38,
    '2019': 2.50,
    '2020': 2.48,
    '2021': 2.70,
    '2022': 4.60,
    '2023': 3.95,
    '2024': 3.60,
    '2025': 3.55,
  },
  SGD: {
    '2015': 98,
    '2016': 108,
    '2017': 113,
    '2018': 120,
    '2019': 132,
    '2020': 138,
    '2021': 148,
    '2022': 265,
    '2023': 242,
    '2024': 225,
    '2025': 220,
  },
  LKR: {
    '2015': 1,
    '2016': 1,
    '2017': 1,
    '2018': 1,
    '2019': 1,
    '2020': 1,
    '2021': 1,
    '2022': 1,
    '2023': 1,
    '2024': 1,
    '2025': 1,
  },
};

/**
 * Precious metals and gems price indices in USD (2015-2025)
 * Based on global commodity markets (London, New York, etc.)
 * Index value (2015 = 100) represents international USD prices
 * 
 * Sources: World Gold Council, Silver Institute, Gemological Institute
 */
interface PriceIndexData {
  [year: string]: number; // Index value (2015 = 100)
}

const COMMODITY_PRICE_INDICES_USD: { [itemType: string]: PriceIndexData } = {
  Gold: {
    // London Bullion Market prices
    '2015': 100,   // ~$1,160/oz
    '2016': 105,   // ~$1,250/oz
    '2017': 107,   // ~$1,257/oz
    '2018': 104,   // ~$1,268/oz
    '2019': 120,   // ~$1,393/oz
    '2020': 153,   // ~$1,770/oz (pandemic surge)
    '2021': 155,   // ~$1,799/oz
    '2022': 148,   // ~$1,800/oz
    '2023': 165,   // ~$1,940/oz
    '2024': 198,   // ~$2,300/oz
    '2025': 210,   // ~$2,450/oz
  },
  Silver: {
    // Silver spot prices
    '2015': 100,   // ~$15.70/oz
    '2016': 106,   // ~$17.10/oz
    '2017': 109,   // ~$17.05/oz
    '2018': 102,   // ~$15.50/oz
    '2019': 108,   // ~$16.20/oz
    '2020': 134,   // ~$20.50/oz
    '2021': 161,   // ~$25.10/oz
    '2022': 138,   // ~$21.70/oz
    '2023': 149,   // ~$23.35/oz
    '2024': 183,   // ~$28.80/oz
    '2025': 195,   // ~$30.50/oz
  },
  Gems: {
    // Colored gemstone market indices (composite)
    '2015': 100,
    '2016': 103,
    '2017': 108,
    '2018': 112,
    '2019': 118,
    '2020': 115,   // Pandemic dip
    '2021': 125,
    '2022': 135,
    '2023': 145,
    '2024': 160,
    '2025': 175,
  },
  Diamond: {
    // Polished diamond prices (Rapaport)
    '2015': 100,
    '2016': 98,
    '2017': 102,
    '2018': 105,
    '2019': 108,
    '2020': 95,    // Pandemic impact
    '2021': 110,
    '2022': 115,
    '2023': 118,
    '2024': 125,
    '2025': 130,
  },
  Ruby: {
    // Premium ruby prices (Myanmar, Mozambique)
    '2015': 100,
    '2016': 105,
    '2017': 112,
    '2018': 118,
    '2019': 125,
    '2020': 122,
    '2021': 135,
    '2022': 148,
    '2023': 160,
    '2024': 175,
    '2025': 190,
  },
  Sapphire: {
    // Premium sapphire prices (Sri Lankan, Kashmir, Madagascar)
    '2015': 100,
    '2016': 104,
    '2017': 110,
    '2018': 115,
    '2019': 122,
    '2020': 120,
    '2021': 132,
    '2022': 145,
    '2023': 158,
    '2024': 172,
    '2025': 185,
  },
  Jewellery: {
    // Composite jewellery retail index (gold-based with craftsmanship)
    '2015': 100,
    '2016': 106,
    '2017': 109,
    '2018': 107,
    '2019': 118,
    '2020': 145,
    '2021': 150,
    '2022': 148,
    '2023': 162,
    '2024': 192,
    '2025': 205,
  },
  Other: {
    // Other precious items (platinum, palladium, semi-precious stones)
    '2015': 100,
    '2016': 103,
    '2017': 107,
    '2018': 110,
    '2019': 115,
    '2020': 125,
    '2021': 135,
    '2022': 138,
    '2023': 145,
    '2024': 158,
    '2025': 170,
  },
};

/**
 * Calculate market value for precious items in LKR considering both USD price appreciation 
 * and USD/LKR exchange rate changes
 * @param originalCost - Original purchase cost in LKR
 * @param itemType - Type of item (Gold, Silver, Gems, etc.)
 * @param acquisitionYear - Year item was acquired
 * @param valuationYear - Year for which to calculate market value
 * @returns Estimated market value in LKR
 */
export function calculatePreciousItemMarketValue(
  originalCost: number,
  itemType: string,
  acquisitionYear: string,
  valuationYear: string
): number {
  const priceIndex = COMMODITY_PRICE_INDICES_USD[itemType] || COMMODITY_PRICE_INDICES_USD['Other'];
  
  const baseUSDIndex = priceIndex[acquisitionYear] || 100;
  const currentUSDIndex = priceIndex[valuationYear] || priceIndex['2025'];
  
  const baseExchangeRate = CURRENCY_TO_LKR_RATES['USD'][acquisitionYear] || 135;
  const currentExchangeRate = CURRENCY_TO_LKR_RATES['USD'][valuationYear] || CURRENCY_TO_LKR_RATES['USD']['2025'];
  
  if (baseUSDIndex === 0) return originalCost;
  
  // Calculate appreciation factor considering both USD price change and exchange rate change
  const usdPriceAppreciation = currentUSDIndex / baseUSDIndex;
  const exchangeRateChange = currentExchangeRate / baseExchangeRate;
  
  // Combined factor = USD price appreciation × exchange rate change
  const totalAppreciationFactor = usdPriceAppreciation * exchangeRateChange;
  
  return originalCost * totalAppreciationFactor;
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
 * Calculate market value for foreign currency deposits (Bii) in LKR
 * Similar to jewellery appreciation, uses exchange rate from balance records
 * @param asset The financial asset (must be cageCategory 'Bii')
 * @param taxYear The tax year for valuation
 * @returns Market value in LKR for the given tax year
 */
export function getForeignCurrencyMarketValue(asset: Asset, taxYear: string): number {
  // Only applicable to bank balances/term deposits with foreign currency
  if (asset.cageCategory !== 'Bii' || !asset.meta.currency || asset.meta.currency === 'LKR') {
    return asset.financials.marketValue;
  }

  const currency = asset.meta.currency;
  
  // Find the balance record for this tax year
  const yearBalance = asset.balances?.find((b) => {
    return b.taxYear === taxYear || b.taxYear.startsWith(taxYear);
  });

  // If we have a balance, calculate market value using currency exchange rate index
  if (yearBalance) {
    // Get exchange rate for the tax year from indices
    const exchangeRate = CURRENCY_TO_LKR_RATES[currency]?.[taxYear];
    
    if (exchangeRate) {
      // Balance (foreign currency) × Exchange Rate = Value in LKR
      return yearBalance.closingBalance * exchangeRate;
    }
  }

  // Fallback: use stored market value if no balance data or exchange rate
  return asset.financials.marketValue;
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
        // Convert to LKR if foreign currency using exchange rate indices
        let interestInLKR = yearBalance.interestEarned;
        if (asset.cageCategory === 'Bii' && asset.meta.currency && asset.meta.currency !== 'LKR') {
          const exchangeRate = CURRENCY_TO_LKR_RATES[asset.meta.currency]?.[taxYear];
          if (exchangeRate) {
            interestInLKR = yearBalance.interestEarned * exchangeRate;
          }
        }
        
        income.push({
          type: 'interest',
          amount: interestInLKR,
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
 * Formula: Risk = (Asset Growth + Property Expenses + Derived Living Expenses + Loan Payments) - (Declared Income - Tax + New Loans + Asset Sales)
 * Living expenses are derived as the balancing figure between outflows and inflows
 */
export function calculateAuditRisk(
  assets: Asset[],
  liabilities: Liability[],
  incomes: Income[],
  currentYear: string
): AuditRisk {
  // Calculate asset growth (assets acquired in current tax year, excluding disposed)
  const assetGrowth = assets
    .filter((a) => isDateInTaxYear(a.meta.dateAcquired, currentYear) && !a.disposed)
    .reduce((sum, a) => sum + a.financials.cost, 0);

  // Calculate asset sales (proceeds from disposed assets in current tax year)
  const assetSales = assets
    .filter((a) => a.disposed && isDateInTaxYear(a.disposed.date, currentYear))
    .reduce((sum, a) => sum + (a.disposed?.salePrice || 0), 0);

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

  // Calculate loan payments made in current tax year (split by principal and interest)
  let loanPrincipal = 0;
  let loanInterest = 0;
  
  liabilities.forEach((l) => {
    if (!l.payments || l.payments.length === 0) return;
    
    const yearPayments = l.payments.filter(p => p.taxYear.toString() === currentYear);
    
    yearPayments.forEach(p => {
      loanPrincipal += p.principalPaid;
      loanInterest += p.interestPaid;
    });
  });

  const loanPayments = loanPrincipal + loanInterest;

  // Calculate declared income with breakdown
  const incomeBreakdown = calculateTotalIncome(
    incomes.filter((i) => i.taxYear === currentYear),
    assets,
    currentYear
  );

  // Calculate actual outflows (excluding living expenses)
  const actualOutflows = assetGrowth + propertyExpenses + loanPayments;
  
  // Calculate actual inflows
  const netIncome = incomeBreakdown.totalIncome - ((incomeBreakdown.totalAPIT || 0) + (incomeBreakdown.totalWHT || 0));
  const actualInflows = netIncome + newLoans + assetSales;
  
  // DERIVE living expenses as the balancing figure
  // Living expenses = Inflows - Outflows (what's left after known expenses)
  // If negative (outflows > inflows), it means unexplained funding
  const derivedLivingExpenses = Math.max(0, actualInflows - actualOutflows);

  // Calculate risk score (if outflows exceed inflows even after accounting for living expenses)
  const totalOutflows = actualOutflows + derivedLivingExpenses;
  const riskScore = totalOutflows - actualInflows;

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
    derivedLivingExpenses,
    loanPayments,
    employmentIncome: incomeBreakdown.employmentIncome,
    businessIncome: incomeBreakdown.businessIncome,
    investmentIncome: incomeBreakdown.investmentIncome,
    totalIncome: incomeBreakdown.totalIncome,
    taxDeducted: (incomeBreakdown.totalAPIT || 0) + (incomeBreakdown.totalWHT || 0),
    newLoans,
    assetSales,
    riskScore,
    riskLevel,
    inflowBreakdown: {
      employmentIncome: incomeBreakdown.employmentIncome,
      businessIncome: incomeBreakdown.businessIncome,
      investmentIncome: incomeBreakdown.investmentIncome,
      newLoans,
      assetSales,
    },
    outflowBreakdown: {
      assetPurchases: assetGrowth,
      loanPrincipal,
      loanInterest,
      propertyExpenses,
      livingExpenses: derivedLivingExpenses,
    },
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
