// Core entity representing a taxpayer
export interface TaxEntity {
  id: string;
  name: string;
  tin?: string;
  nic?: string;
  mobile?: string;
  email?: string;
  type: 'individual' | 'company' | 'partnership' | 'trust';
  taxYear: string;
  role?: 'primary' | 'spouse';
  createdAt: string;
}

// Source of funds for asset acquisition (FR-07)
export interface FundingSource {
  type: 'current-income' | 'asset-sale' | 'loan' | 'gift' | 'savings';
  amount: number;
  description?: string;
  relatedId?: string; // ID of related income, asset, or liability
}

// Asset Object (Maps to Cages 701-721)
export interface Asset {
  id: string;
  ownerId: string;
  ownershipShares?: { entityId: string; percentage: number }[]; // Multiple owners with percentages
  cageCategory: '701' | '711' | '721'; // Immovable Property, Vehicle, Bank/Financial
  meta: {
    description: string;
    dateAcquired: string;
    // Immovable Property (701)
    address?: string;
    deedNo?: string;
    // Vehicle (711)
    regNo?: string;
    brand?: string;
    // Bank/Financial (721)
    accountNo?: string;
    bankName?: string;
  };
  financials: {
    cost: number;
    marketValue: number;
    sourceOfFunds?: FundingSource[];
  };
  fundingSources?: FundingSource[];
  balances?: FinancialAssetBalance[]; // Yearly balances for financial assets (721)
  disposed?: {
    date: string;
    salePrice: number;
  };
}

// Payment record for liabilities
export interface LiabilityPayment {
  id: string;
  date: string;
  principalPaid: number;
  interestPaid: number;
  totalPaid: number;
  balanceAfterPayment: number;
  taxYear: string;
  notes?: string;
}

// Balance record for financial assets (bank accounts, investments, etc.)
export interface FinancialAssetBalance {
  id: string;
  taxYear: string;
  closingBalance: number; // Balance as of March 31 of the tax year
  interestEarned: number; // Interest income for the year
  notes?: string;
}

// Liability Object (Cage 781)
export interface Liability {
  id: string;
  ownerId: string;
  ownershipShares?: { entityId: string; percentage: number }[]; // Multiple owners with percentages
  description: string;
  lenderName: string;
  originalAmount: number;
  currentBalance: number;
  securityGiven?: string;
  date: string;
  dateAcquired: string;
  interestRate?: number;
  purpose?: string;
  payments?: LiabilityPayment[]; // Payment history
  paymentFrequency?: 'monthly' | 'quarterly' | 'annually' | 'other';
  maturityDate?: string;
}

// Income Schedules
export interface EmploymentIncome {
  id: string;
  ownerId: string;
  schedule: '1';
  taxYear: string;
  details: {
    employerName: string;
    employerTIN: string;
    grossRemuneration: number; // Cage 103
    nonCashBenefits: number; // Cage 104
    apitDeducted: number; // Links to Tax Credit Cage 903
    exemptIncome: number;
  };
}

export interface BusinessIncome {
  id: string;
  ownerId: string;
  schedule: '2';
  taxYear: string;
  details: {
    businessName: string;
    grossRevenue: number; // Cage 201
    directExpenses: number; // Cage 202
    netProfit: number; // Cage 203 (Gains and Profits)
  };
}

export interface InvestmentIncome {
  id: string;
  ownerId: string;
  schedule: '3';
  taxYear: string;
  type: 'interest' | 'dividend' | 'rent';
  details: {
    source: string;
    grossAmount: number; // Cage 303
    whtDeducted: number; // Links to Tax Credit Cage 908
    // Rent-specific
    rentRelief?: number; // 25% Relief Cage 316
  };
}

export type Income = EmploymentIncome | BusinessIncome | InvestmentIncome;

// Tax Calculation
export interface TaxComputation {
  assessableIncome: number;
  reliefs: {
    personalRelief: number; // Rs. 1,200,000
    solarRelief: number; // Max Rs. 600,000
  };
  taxableIncome: number;
  taxOnIncome: number;
  taxCredits: {
    apit: number; // Cage 903
    wht: number; // Cage 908
  };
  taxPayable: number;
}

// Audit Risk (The Danger Meter)
export interface AuditRisk {
  assetGrowth: number;
  estimatedLivingExpenses: number;
  declaredIncome: number;
  newLoans: number;
  loanPayments: number; // Total loan payments (principal + interest) for the year
  riskScore: number; // (assetGrowth + expenses + loanPayments) - (income + newLoans)
  riskLevel: 'safe' | 'warning' | 'danger';
}

// App State
export interface AppState {
  entities: TaxEntity[];
  assets: Asset[];
  liabilities: Liability[];
  incomes: Income[];
  currentTaxYear: string;
  jointAssetSplitRatio: { [entityId: string]: number }; // Default 50/50
  isEncrypted: boolean;
  lastSaved?: string;
}
