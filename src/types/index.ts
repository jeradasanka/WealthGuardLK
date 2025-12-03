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
  taxPayable?: { [taxYear: string]: number }; // Manual total tax payable per tax year
  totalTaxOnIncome?: { [taxYear: string]: number }; // Total tax payable before credits (manual or calculated)
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
    currency?: 'LKR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'JPY' | 'CNY' | 'INR' | 'SGD'; // Currency for foreign deposits
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
  closingBalance: number; // Balance as of March 31 of the tax year (in original currency)
  interestEarned: number; // Interest income for the year (in original currency)
  exchangeRate?: number; // Exchange rate to LKR at year end (for foreign currency deposits)
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
  numberOfTerms?: number; // Total number of payment terms for installment calculation
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

// AIT/WHT Certificate Tracking
export interface AITWHTCertificate {
  id: string;
  ownerId: string;
  taxYear: string;
  certificateNo: string;
  paymentDate: string; // Date when payment was made
  type: 'employment' | 'interest' | 'dividend' | 'rent' | 'other';
  details: {
    payerName: string; // Employer, Bank, Tenant, etc.
    payerTIN: string;
    grossAmount: number; // Total amount before deduction
    taxDeducted: number; // APIT or WHT amount
    netAmount: number; // Amount received after deduction
    description?: string;
  };
  relatedIncomeId?: string; // Link to related income record
  documentPath?: string; // Path to scanned certificate (future feature)
  verified?: boolean; // Manual verification flag
  notes?: string;
}

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
  propertyExpenses: number; // Property expenses (repairs, construction, etc.) for the year
  derivedLivingExpenses: number; // Calculated as balance between outflows and inflows
  loanPayments: number; // Total loan payments (principal + interest) for the year
  employmentIncome: number;
  businessIncome: number;
  investmentIncome: number;
  totalIncome: number;
  taxDeducted: number; // APIT + WHT
  newLoans: number;
  assetSales: number; // Proceeds from asset disposals
  riskScore: number; // (assetGrowth + propertyExpenses + derivedLivingExpenses + loanPayments) - (income - tax + newLoans + assetSales)
  riskLevel: 'safe' | 'warning' | 'danger';
  inflowBreakdown: {
    employmentIncome: number;
    businessIncome: number;
    investmentIncome: number;
    newLoans: number;
    assetSales: number;
  };
  outflowBreakdown: {
    assetPurchases: number;
    loanPrincipal: number;
    loanInterest: number;
    propertyExpenses: number;
    livingExpenses: number;
  };
}

// App State
export interface AppState {
  entities: TaxEntity[];
  assets: Asset[];
  liabilities: Liability[];
  incomes: Income[];
  certificates: AITWHTCertificate[];
  currentTaxYear: string;
  jointAssetSplitRatio: { [entityId: string]: number }; // Default 50/50
  isEncrypted: boolean;
  lastSaved?: string;
}
