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
  OtherIncome,
  AITWHTCertificate,
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
 * Currency exchange rate indices (as of March 31 each year)
 * Key = Tax year start year (e.g., "2024" = tax year 2024/2025, rate as of March 31, 2025)
 * Based on Central Bank of Sri Lanka historical data
 * Index represents the exchange rate (1 foreign currency = X LKR) as of March 31
 */
const CURRENCY_TO_LKR_RATES: { [currency: string]: { [year: string]: number } } = {
  USD: {
    '2014': 135,   // As of March 31, 2015
    '2015': 149,   // As of March 31, 2016
    '2016': 153,   // As of March 31, 2017
    '2017': 162,   // As of March 31, 2018
    '2018': 178,   // As of March 31, 2019
    '2019': 185,   // As of March 31, 2020
    '2020': 200,   // As of March 31, 2021
    '2021': 360,   // As of March 31, 2022 (Major devaluation)
    '2022': 325,   // As of March 31, 2023
    '2023': 300,   // As of March 31, 2024
    '2024': 295,   // As of March 31, 2025
    '2025': 290,   // As of March 31, 2026 (projected)
  },
  EUR: {
    '2014': 150,
    '2015': 165,
    '2016': 180,
    '2017': 190,
    '2018': 200,
    '2019': 210,
    '2020': 235,
    '2021': 380,
    '2022': 350,
    '2023': 330,
    '2024': 325,
    '2025': 320,
  },
  GBP: {
    '2014': 205,
    '2015': 200,
    '2016': 210,
    '2017': 220,
    '2018': 230,
    '2019': 240,
    '2020': 270,
    '2021': 435,
    '2022': 405,
    '2023': 385,
    '2024': 378,
    '2025': 375,
  },
  AUD: {
    '2014': 100,
    '2015': 110,
    '2016': 118,
    '2017': 120,
    '2018': 125,
    '2019': 128,
    '2020': 148,
    '2021': 250,
    '2022': 215,
    '2023': 200,
    '2024': 195,
    '2025': 192,
  },
  CAD: {
    '2014': 105,
    '2015': 112,
    '2016': 120,
    '2017': 125,
    '2018': 135,
    '2019': 140,
    '2020': 160,
    '2021': 280,
    '2022': 245,
    '2023': 225,
    '2024': 218,
    '2025': 215,
  },
  JPY: {
    '2014': 1.15,
    '2015': 1.35,
    '2016': 1.38,
    '2017': 1.48,
    '2018': 1.65,
    '2019': 1.75,
    '2020': 1.75,
    '2021': 2.75,
    '2022': 2.30,
    '2023': 2.05,
    '2024': 2.00,
    '2025': 1.95,
  },
  CNY: {
    '2014': 21,
    '2015': 22,
    '2016': 23,
    '2017': 24,
    '2018': 26,
    '2019': 27,
    '2020': 31,
    '2021': 54,
    '2022': 45,
    '2023': 42,
    '2024': 41,
    '2025': 40,
  },
  INR: {
    '2014': 2.10,
    '2015': 2.25,
    '2016': 2.35,
    '2017': 2.38,
    '2018': 2.50,
    '2019': 2.48,
    '2020': 2.70,
    '2021': 4.60,
    '2022': 3.95,
    '2023': 3.60,
    '2024': 3.55,
    '2025': 3.50,
  },
  SGD: {
    '2014': 98,
    '2015': 108,
    '2016': 113,
    '2017': 120,
    '2018': 132,
    '2019': 138,
    '2020': 148,
    '2021': 265,
    '2022': 242,
    '2023': 225,
    '2024': 220,
    '2025': 218,
  },
  LKR: {
    '2014': 1,
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
 * Precious metals and gems price indices in USD (as of March 31 each year)
 * Key = Tax year start year (e.g., "2024" = tax year 2024/2025, price as of March 31, 2025)
 * Based on global commodity markets (London, New York, etc.)
 * Index value (2014 = 100) represents international USD prices as of March 31
 * 
 * Sources: World Gold Council, Silver Institute, Gemological Institute
 */
interface PriceIndexData {
  [year: string]: number; // Index value (2014 = 100)
}

const COMMODITY_PRICE_INDICES_USD: { [itemType: string]: PriceIndexData } = {
  Gold: {
    // London Bullion Market prices (as of March 31)
    '2014': 100,   // ~$1,160/oz (March 31, 2015)
    '2015': 105,   // ~$1,250/oz (March 31, 2016)
    '2016': 107,   // ~$1,257/oz (March 31, 2017)
    '2017': 104,   // ~$1,268/oz (March 31, 2018)
    '2018': 120,   // ~$1,393/oz (March 31, 2019)
    '2019': 153,   // ~$1,770/oz (March 31, 2020 - pandemic surge)
    '2020': 155,   // ~$1,799/oz (March 31, 2021)
    '2021': 148,   // ~$1,800/oz (March 31, 2022)
    '2022': 165,   // ~$1,940/oz (March 31, 2023)
    '2023': 198,   // ~$2,300/oz (March 31, 2024)
    '2024': 210,   // ~$2,450/oz (March 31, 2025)
    '2025': 220,   // ~$2,550/oz (March 31, 2026 - projected)
  },
  Silver: {
    // Silver spot prices (as of March 31)
    '2014': 100,   // ~$15.70/oz
    '2015': 106,   // ~$17.10/oz
    '2016': 109,   // ~$17.05/oz
    '2017': 102,   // ~$15.50/oz
    '2018': 108,   // ~$16.20/oz
    '2019': 134,   // ~$20.50/oz
    '2020': 161,   // ~$25.10/oz
    '2021': 138,   // ~$21.70/oz
    '2022': 149,   // ~$23.35/oz
    '2023': 183,   // ~$28.80/oz
    '2024': 195,   // ~$30.50/oz
    '2025': 205,   // ~$32.00/oz (projected)
  },
  Gems: {
    // Colored gemstone market indices (composite, as of March 31)
    '2014': 100,
    '2015': 103,
    '2016': 108,
    '2017': 112,
    '2018': 118,
    '2019': 115,   // Pandemic dip
    '2020': 125,
    '2021': 135,
    '2022': 145,
    '2023': 160,
    '2024': 175,
    '2025': 185,
  },
  Diamond: {
    // Polished diamond prices (Rapaport, as of March 31)
    '2014': 100,
    '2015': 98,
    '2016': 102,
    '2017': 105,
    '2018': 108,
    '2019': 95,    // Pandemic impact
    '2020': 110,
    '2021': 115,
    '2022': 118,
    '2023': 125,
    '2024': 130,
    '2025': 135,
  },
  Ruby: {
    // Premium ruby prices (Myanmar, Mozambique, as of March 31)
    '2014': 100,
    '2015': 105,
    '2016': 112,
    '2017': 118,
    '2018': 125,
    '2019': 122,
    '2020': 135,
    '2021': 148,
    '2022': 160,
    '2023': 175,
    '2024': 190,
    '2025': 200,
  },
  Sapphire: {
    // Premium sapphire prices (Sri Lankan, Kashmir, Madagascar, as of March 31)
    '2014': 100,
    '2015': 104,
    '2016': 110,
    '2017': 115,
    '2018': 122,
    '2019': 120,
    '2020': 132,
    '2021': 145,
    '2022': 158,
    '2023': 172,
    '2024': 185,
    '2025': 195,
  },
  Jewellery: {
    // Composite jewellery retail index (gold-based with craftsmanship, as of March 31)
    '2014': 100,
    '2015': 106,
    '2016': 109,
    '2017': 107,
    '2018': 118,
    '2019': 145,
    '2020': 150,
    '2021': 148,
    '2022': 162,
    '2023': 192,
    '2024': 205,
    '2025': 215,
  },
  Other: {
    // Other precious items (platinum, palladium, semi-precious stones, as of March 31)
    '2014': 100,
    '2015': 103,
    '2016': 107,
    '2017': 110,
    '2018': 115,
    '2019': 125,
    '2020': 135,
    '2021': 138,
    '2022': 145,
    '2023': 158,
    '2024': 170,
    '2025': 180,
  },
};

/**
 * Calculate market value for precious items in LKR considering both USD price appreciation 
 * and USD/LKR exchange rate changes (both as of March 31)
 * @param originalCost - Original purchase cost in LKR
 * @param itemType - Type of item (Gold, Silver, Gems, etc.)
 * @param acquisitionYear - Year item was acquired (YYYY)
 * @param taxYear - Tax year for valuation (uses March 31 of taxYear+1)
 * @returns Estimated market value in LKR
 */
export function calculatePreciousItemMarketValue(
  originalCost: number,
  itemType: string,
  acquisitionYear: string,
  taxYear: string
): number {
  const priceIndex = COMMODITY_PRICE_INDICES_USD[itemType] || COMMODITY_PRICE_INDICES_USD['Other'];
  
  // For acquisition year, use the tax year the asset was acquired in
  // If acquired in May 2018, that's tax year 2018/2019, so use 2018 rates
  const baseUSDIndex = priceIndex[acquisitionYear] || 100;
  
  // For valuation, tax year "2024" uses March 31, 2025 rates (already in index as 2024)
  const currentUSDIndex = priceIndex[taxYear] || priceIndex['2025'];
  
  const baseExchangeRate = CURRENCY_TO_LKR_RATES['USD'][acquisitionYear] || 135;
  const currentExchangeRate = CURRENCY_TO_LKR_RATES['USD'][taxYear] || CURRENCY_TO_LKR_RATES['USD']['2025'];
  
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
 * @param taxYear - Tax year for valuation (uses March 31 of taxYear+1)
 * @returns Market value for the given tax year
 */
export function getJewelleryMarketValue(asset: Asset, taxYear: string): number {
  if (asset.cageCategory !== 'Bvi') {
    return asset.financials.marketValue;
  }

  const itemType = asset.meta.itemType || 'Other';
  const acquisitionYear = asset.meta.dateAcquired.substring(0, 4); // Get year from YYYY-MM-DD
  
  // Tax year "2024" already maps to March 31, 2025 in indices - no need to add 1
  return calculatePreciousItemMarketValue(
    asset.financials.cost,
    itemType,
    acquisitionYear,
    taxYear  // Indices are pre-shifted to March 31
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

  // Fallback: If no balance record, use stored market value (which is in foreign currency)
  // Convert it to LKR using current year's exchange rate
  const exchangeRate = CURRENCY_TO_LKR_RATES[currency]?.[taxYear];
  if (exchangeRate) {
    // Market value is stored in foreign currency, convert to LKR
    return asset.financials.marketValue * exchangeRate;
  }

  // Last resort: return as-is (shouldn't happen if exchange rates are complete)
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
  currentTaxYear: string = '2024',
  certificates: AITWHTCertificate[] = []
): {
  employmentIncome: number;
  businessIncome: number;
  investmentIncome: number;
  otherIncome: number;
  totalIncome: number;
  totalAPIT: number;
  totalWHT: number;
} {
  let employmentIncome = 0;
  let businessIncome = 0;
  let investmentIncome = 0;
  let otherIncome = 0;
  let totalAPIT = 0;
  let totalWHT = 0;

  // Process manual income entries
  incomes.forEach((income) => {
    switch (income.schedule) {
      case '1': {
        const emp = income as EmploymentIncome;
        // Gross income minus exempt income = taxable employment income
        const grossIncome = (emp.details.grossRemuneration || 0) + (emp.details.nonCashBenefits || 0);
        const taxableIncome = grossIncome - (emp.details.exemptIncome || 0);
        employmentIncome += taxableIncome;
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
      case '4': {
        const other = income as OtherIncome;
        // Cage 401 - Cage 402 = Taxable Other Income
        const taxableAmount = (other.details.grossAmount || 0) - (other.details.exemptAmount || 0);
        otherIncome += taxableAmount;
        totalWHT += (other.details.whtDeducted || 0);
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

  // Process tax credits from certificates (FR-12)
  const yearCertificates = certificates.filter(cert => cert.taxYear === currentTaxYear);
  
  // APIT from employment certificates
  const apitFromCerts = yearCertificates
    .filter(c => c.type === 'employment')
    .reduce((sum, c) => sum + (c.details.taxDeducted || 0), 0);
  totalAPIT += apitFromCerts;
  
  // WHT from investment certificates (interest, dividend, rent, other)
  const whtFromCerts = yearCertificates
    .filter(c => c.type !== 'employment')
    .reduce((sum, c) => sum + (c.details.taxDeducted || 0), 0);
  totalWHT += whtFromCerts;

  return {
    employmentIncome,
    businessIncome,
    investmentIncome,
    otherIncome,
    totalIncome: employmentIncome + businessIncome + investmentIncome + otherIncome,
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
  solarInvestment: number = 0,
  certificates: AITWHTCertificate[] = []
): TaxComputation {
  const {
    totalIncome,
    totalAPIT,
    totalWHT,
  } = calculateTotalIncome(incomes, assets, currentTaxYear, certificates);

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
    totalIncome,
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

  // Calculate balance changes in existing financial assets (Bii, Biv, Bv)
  // This tracks money deposited/withdrawn from savings accounts, cash, loans given
  let balanceIncreases = 0;
  let balanceDecreases = 0;
  
  // Track stock broker cash transfers separately
  let stockCashDeposits = 0; // Positive cash transfers (outflow)
  let stockCashWithdrawals = 0; // Negative cash transfers (inflow)
  
  const previousYear = (parseInt(currentYear) - 1).toString();
  
  assets.forEach((asset) => {
    // Process stock balances (Biii - Shares/Stocks)
    if (asset.cageCategory === 'Biii' && asset.stockBalances) {
      const currentYearStockBalance = asset.stockBalances.find(
        b => b.taxYear === currentYear || b.taxYear.startsWith(currentYear)
      );
      
      if (currentYearStockBalance) {
        const cashTransfers = currentYearStockBalance.cashTransfers || 0;
        
        if (cashTransfers > 0) {
          // Positive = deposit to broker (outflow from personal funds)
          stockCashDeposits += cashTransfers;
        } else if (cashTransfers < 0) {
          // Negative = withdrawal from broker (inflow to personal funds)
          stockCashWithdrawals += Math.abs(cashTransfers);
        }
      }
    }
    
    // Only process financial assets (Bank, Cash, Loans Given) that existed before current year
    if ((asset.cageCategory === 'Bii' || asset.cageCategory === 'Biv' || asset.cageCategory === 'Bv') 
        && !isDateInTaxYear(asset.meta.dateAcquired, currentYear) 
        && !asset.closed 
        && !asset.disposed
        && asset.balances) {
      
      const currentYearBalance = asset.balances.find(b => b.taxYear === currentYear || b.taxYear.startsWith(currentYear));
      const previousYearBalance = asset.balances.find(b => b.taxYear === previousYear || b.taxYear.startsWith(previousYear));
      
      if (currentYearBalance) {
        const prevBalance = previousYearBalance?.closingBalance || asset.financials.cost || 0;
        const currBalance = currentYearBalance.closingBalance;
        const interestEarned = currentYearBalance.interestEarned || 0;
        
        // Net change = (Current Balance - Previous Balance) - Interest Earned
        // Positive = deposits (outflow), Negative = withdrawals (inflow)
        const netChange = (currBalance - prevBalance) - interestEarned;
        
        // Convert to LKR if foreign currency
        let netChangeInLKR = netChange;
        if (asset.cageCategory === 'Bii' && asset.meta.currency && asset.meta.currency !== 'LKR') {
          const exchangeRate = CURRENCY_TO_LKR_RATES[asset.meta.currency]?.[currentYear];
          if (exchangeRate) {
            netChangeInLKR = netChange * exchangeRate;
          }
        }
        
        if (netChangeInLKR > 0) {
          balanceIncreases += netChangeInLKR;
        } else if (netChangeInLKR < 0) {
          balanceDecreases += Math.abs(netChangeInLKR);
        }
      }
    }
  });

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
  // Includes: new asset purchases + balance increases in existing accounts + property expenses + loan payments + stock cash deposits
  const actualOutflows = assetGrowth + balanceIncreases + propertyExpenses + loanPayments + stockCashDeposits;
  
  // Calculate actual inflows
  // Includes: net income + new loans + asset sales + savings withdrawals + stock cash withdrawals
  const netIncome = incomeBreakdown.totalIncome - ((incomeBreakdown.totalAPIT || 0) + (incomeBreakdown.totalWHT || 0));
  const actualInflows = netIncome + newLoans + assetSales + balanceDecreases + stockCashWithdrawals;
  
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
      balanceDecreases, // Savings withdrawals as inflow
      stockCashWithdrawals, // Cash withdrawn from broker
    },
    outflowBreakdown: {
      assetPurchases: assetGrowth,
      balanceIncreases, // Savings deposits as outflow
      stockCashDeposits, // Cash deposited to broker
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
