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

// Asset Object - Statement of Assets and Liabilities
export interface Asset {
  id: string;
  ownerId: string;
  ownershipShares?: { entityId: string; percentage: number }[]; // Multiple owners with percentages
  cageCategory: 'A' | 'Bi' | 'Bii' | 'Biii' | 'Biv' | 'Bv' | 'Bvi' | 'C'; // Asset categories as per tax return
  meta: {
    description: string;
    dateAcquired: string;
    // A - Immovable Properties
    address?: string;
    deedNo?: string;
    extentArea?: string;
    // Bi - Motor Vehicles
    regNo?: string;
    brand?: string;
    model?: string;
    // Bii - Bank Balances / Term Deposits
    accountNo?: string;
    bankName?: string;
    accountType?: string; // Savings, Current, Fixed Deposit, etc.
    // Biii - Shares/stocks/securities
    companyName?: string;
    numberOfShares?: number;
    certificateNo?: string;
    // Biv - Cash in hand (no specific fields needed)
    // Bv - Loans given & amount receivable
    borrowerName?: string;
    agreementNo?: string;
    interestRate?: number;
    // Bvi - Value of gold, silver, gems, jewellery
    itemType?: string; // Gold, Silver, Gems, Jewellery
    weight?: number;
    purity?: string;
    // C - Properties held as part of business
    businessName?: string;
    businessRegNo?: string;
  };
  financials: {
    cost: number;
    marketValue: number;
    sourceOfFunds?: FundingSource[];
  };
  fundingSources?: FundingSource[];
  balances?: FinancialAssetBalance[]; // Yearly balances for Bii (Bank/Term Deposits), Biv (Cash), Bv (Loans Given)
  jewelleryTransactions?: JewelleryTransaction[]; // Yearly purchases/sales for Bvi (Jewellery)
  propertyExpenses?: PropertyExpense[]; // Yearly expenses for A (Immovable Properties)
  closed?: { // For financial assets (Bii, Biv, Bv) - account closure
    date: string;
    finalBalance: number;
  };
  disposed?: { // For sale/disposal of assets (A, Bvi, etc.)
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

// Yearly transaction record for jewellery (Bvi) - purchases and sales
export interface JewelleryTransaction {
  id: string;
  taxYear: string;
  type: 'purchase' | 'sale';
  date: string;
  description: string;
  itemType?: string; // Gold, Silver, Gems, Jewellery
  weight?: number;
  purity?: string;
  amount: number; // Purchase cost or sale price
  notes?: string;
}

// Yearly expense record for immovable properties (A) - repairs, construction, etc.
export interface PropertyExpense {
  id: string;
  taxYear: string;
  date: string;
  description: string;
  expenseType: 'repair' | 'construction' | 'renovation' | 'maintenance' | 'other';
  amount: number;
  marketValue?: number; // Market valuation for this year
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
