// Types for PDF import functionality

export interface ParsedTaxData {
  taxYear: string;
  taxpayerInfo?: {
    name?: string;
    tin?: string;
    nic?: string;
  };
  employmentIncome?: Array<{
    employerName: string;
    employerTIN?: string;
    grossRemuneration: number;
    nonCashBenefits?: number;
    apitDeducted?: number;
    exemptIncome?: number;
  }>;
  businessIncome?: Array<{
    businessName: string;
    grossRevenue: number;
    directExpenses?: number;
    netProfit: number;
  }>;
  investmentIncome?: Array<{
    source: string;
    dividends?: number;
    interest?: number;
    rent?: number;
    wht?: number;
  }>;
  assets?: Array<{
    description: string;
    category: 'A' | 'Bi' | 'Bii' | 'Biii' | 'Biv' | 'Bv' | 'Bvi' | 'C';
    cost: number;
    marketValue: number;
    dateAcquired?: string;
  }>;
  liabilities?: Array<{
    description: string;
    lenderName: string;
    originalAmount: number;
    currentBalance: number;
    dateAcquired?: string;
  }>;
}

export interface ImportPreview {
  parsedData: ParsedTaxData;
  conflicts: ImportConflict[];
  summary: {
    newItems: number;
    updates: number;
    skipped: number;
  };
}

export interface ImportConflict {
  type: 'duplicate' | 'mismatch' | 'missing-info';
  category: 'employment' | 'business' | 'investment' | 'asset' | 'liability';
  message: string;
  existingData?: any;
  newData: any;
  resolution?: 'skip' | 'overwrite' | 'merge';
}

export interface ImportOptions {
  taxYear: string;
  ownerId: string;
  overwriteExisting: boolean;
  skipDuplicates: boolean;
  autoResolveConflicts: boolean;
}
