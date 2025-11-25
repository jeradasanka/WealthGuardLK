// Core entity representing a taxpayer
export interface TaxEntity {
  id: string;
  name: string;
  tin: string;
  mobile: string;
  email: string;
  role: 'primary' | 'spouse';
  createdAt: string;
}

// Source of funds for asset acquisition (FR-07)
export type FundingSource = 
  | { type: 'income'; scheduleId: string; amount: number }
  | { type: 'asset_sale'; assetId: string; amount: number }
  | { type: 'loan'; loanId: string; amount: number }
  | { type: 'gift'; description: string; amount: number }
  | { type: 'inheritance'; description: string; amount: number }
  | { type: 'savings'; description: string; amount: number };

// Asset Object (Maps to Cages 701-721)
export interface Asset {
  id: string;
  ownerId: string;
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
  disposed?: {
    date: string;
    salePrice: number;
  };
}

// Liability Object (Cage 781)
export interface Liability {
  id: string;
  ownerId: string;
  lenderName: string;
  originalAmount: number;
  currentBalance: number;
  securityGiven?: string;
  dateAcquired: string;
  interestRate?: number;
  purpose?: string;
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
  riskScore: number; // (assetGrowth + expenses) - (income + loans)
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
