/**
 * Dynamic Bookmarklet Generator for IRD RAMIS Portal
 *
 * Encodes user tax data (MainReturnForm + Schedules 1-4, 7 + Statement of
 * Assets & Liabilities) using UTF-8-safe Base64 and wraps the unminified
 * payload runner into a compact, CSP-safe `javascript:` URI.
 */

import {
  buildUnminifiedIrdPayloadScript,
  DEFAULT_RAMIS_FIELD_MAP,
  DEFAULT_RAMIS_GRID_MAP,
  type IrdFieldMapping,
  type IrdGridMapping,
} from '@/lib/irdBookmarkletPayload';
import type {
  AITWHTCertificate,
  Asset,
  BusinessIncome,
  EmploymentIncome,
  Income,
  InvestmentIncome,
  Liability,
  OtherIncome,
  TaxComputation,
} from '@/types';

export interface IrdTaxPayload {
  /** Schedule 1: Employment Income (DeclarationTax_Rtn_Cage10) */
  employmentIncome?: number;
  /** Schedule 2: Business Income (DeclarationTax_Rtn_Cage20) */
  businessIncome?: number;
  /** Schedule 3: Investment Income (DeclarationTax_Rtn_Cage30) */
  investmentIncome?: number;
  /** Schedule 4: Other Income (DeclarationTax_Rtn_Cage40) */
  otherIncome?: number;
  /** Personal Relief (Deduction_Rtn_Cage100) */
  personalRelief?: number;
  /** Qualifying Payments / Solar & Other Reliefs (Deduction_Rtn_Cage120) */
  qualifyingPayments?: number;
  /** Statement of Assets flags */
  hasLocalAssets?: boolean;
  hasForeignAssets?: boolean;
  /** Itemized Schedule 1-4 & 7 Kendo Grid rows */
  schedule1Rows?: Array<{ tin: string; employerName: string; amount: number }>;
  schedule2Rows?: Array<{ businessName: string; amount: number }>;
  schedule3Rows?: Array<{ source: string; amount: number }>;
  schedule4Rows?: Array<{ description: string; amount: number }>;
  schedule7Rows?: Array<{
    sourceType: string;
    tin: string;
    name: string;
    certificateNo: string;
    grossAmount: number;
    paymentDate: string;
    taxDeducted: number;
  }>;
  /** Itemized Statement of Assets & Liabilities Kendo Grid rows */
  statement1ARows?: Array<{ description: string; dateAcquired: string; cost: number; marketValue: number }>;
  statement1B1Rows?: Array<{ description: string; regNo: string; dateAcquired: string; cost: number }>;
  statement1B2Rows?: Array<{
    bankName: string;
    accountNo: string;
    amountInvested: number;
    interest: number;
    balance: number;
  }>;
  statement1B3Rows?: Array<{
    company: string;
    shares: string;
    dateAcquired: string;
    cost: number;
    dividendIncome: number;
  }>;
  statement1DRows?: Array<{
    security: string;
    lender: string;
    dateIncurred: string;
    originalAmount: number;
    amount: number;
  }>;
  /** Allow custom mapped fields for additional RAMIS schedules */
  [key: string]: unknown;
}

export interface GeneratedBookmarklet {
  /** Final `javascript:...` URI ready for `<a href>` or clipboard */
  uri: string;
  /** Readable, unminified payload source code before encoding */
  unminifiedSource: string;
  /** UTF-8 Base64 encoded data string */
  encodedData: string;
  /** Total URI byte length (for browser bookmark size awareness) */
  byteSize: number;
  /** Number of non-empty fields + grid rows included in the payload */
  fieldCount: number;
}

/**
 * Encodes an arbitrary JSON-serializable object into UTF-8-safe Base64.
 * Avoids `btoa()`'s Latin-1 crash on Unicode characters (e.g. Sinhala/Tamil).
 */
export function encodePayloadUTF8(data: Record<string, unknown>): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a UTF-8 Base64 string back into an object (used for validation/tests).
 */
export function decodePayloadUTF8<T = Record<string, unknown>>(base64: string): T {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const json = new TextDecoder('utf-8').decode(bytes);
  return JSON.parse(json) as T;
}

/**
 * State-aware JavaScript minifier for bookmarklet payloads.
 * Strips comments and collapses unnecessary whitespace while preserving
 * single-quoted, double-quoted, and template string literals intact.
 */
export function minifyBookmarkletScript(source: string): string {
  let out = '';
  let i = 0;
  const len = source.length;
  let lastNonWs = '';

  const isIdentChar = (ch: string) => /[a-zA-Z0-9_$]/.test(ch);

  while (i < len) {
    const ch = source[i];
    const next = source[i + 1];

    // String literals ('...', "...", `...`)
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      out += ch;
      i++;
      while (i < len) {
        const c = source[i];
        out += c;
        if (c === '\\' && i + 1 < len) {
          out += source[i + 1];
          i += 2;
          continue;
        }
        i++;
        if (c === quote) break;
      }
      lastNonWs = quote;
      continue;
    }

    // Single-line comment // ...
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < len && source[i] !== '\n') i++;
      continue;
    }

    // Multi-line comment /* ... */
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < len && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // Collapse whitespace runs
    if (/\s/.test(ch)) {
      while (i < len && /\s/.test(source[i])) i++;
      const upcoming = source[i] || '';
      if (
        (isIdentChar(lastNonWs) && isIdentChar(upcoming)) ||
        (lastNonWs === '+' && upcoming === '+') ||
        (lastNonWs === '-' && upcoming === '-')
      ) {
        out += ' ';
      }
      continue;
    }

    out += ch;
    lastNonWs = ch;
    i++;
  }

  return out.trim();
}

const round2 = (n: number) => Math.round((n || 0) * 100) / 100;

/**
 * Maps summary computation totals into the MainReturnForm Cage payload.
 */
export function buildIrdPayloadFromComputation(params: {
  employmentTotal: number;
  businessTotal: number;
  investmentTotal: number;
  derivedInvestmentTotal?: number;
  otherTotal: number;
  personalRelief: number;
  solarRelief?: number;
}): IrdTaxPayload {
  const totalInvestment = (params.investmentTotal || 0) + (params.derivedInvestmentTotal || 0);

  return {
    employmentIncome: round2(params.employmentTotal),
    businessIncome: round2(params.businessTotal),
    investmentIncome: round2(totalInvestment),
    otherIncome: round2(params.otherTotal),
    personalRelief: round2(params.personalRelief),
    qualifyingPayments: round2(params.solarRelief || 0),
  };
}

/**
 * Maps full WealthGuardLK store data (MainReturn + Schedules 1-4, 7 + Statement
 * of Assets & Liabilities) into a single all-in-one IRD RAMIS payload.
 */
export function buildFullIrdPayloadFromStore(params: {
  incomes: Income[];
  assets: Asset[];
  liabilities: Liability[];
  certificates: AITWHTCertificate[];
  currentTaxYear: string;
  computation: TaxComputation;
  derivedInterest?: number;
  derivedDividends?: number;
}): IrdTaxPayload {
  const {
    incomes,
    assets,
    liabilities,
    certificates,
    currentTaxYear,
    computation,
    derivedInterest = 0,
    derivedDividends = 0,
  } = params;

  const yearIncomes = incomes.filter((i) => !i.taxYear || i.taxYear === currentTaxYear);
  const empIncomes = yearIncomes.filter((i): i is EmploymentIncome => i.schedule === '1');
  const busIncomes = yearIncomes.filter((i): i is BusinessIncome => i.schedule === '2');
  const invIncomes = yearIncomes.filter((i): i is InvestmentIncome => i.schedule === '3');
  const othIncomes = yearIncomes.filter((i): i is OtherIncome => i.schedule === '4');

  const employmentTotal = empIncomes.reduce(
    (sum, i) =>
      sum +
      Math.max(
        0,
        (i.details.grossRemuneration || 0) +
          (i.details.nonCashBenefits || 0) -
          (i.details.exemptIncome || 0)
      ),
    0
  );
  const businessTotal = busIncomes.reduce((sum, i) => sum + (i.details.netProfit || 0), 0);
  const investmentTotal =
    invIncomes.reduce((sum, i) => sum + (i.details.grossAmount || 0), 0) +
    derivedInterest +
    derivedDividends;
  const otherTotal = othIncomes.reduce(
    (sum, i) => sum + Math.max(0, (i.details.grossAmount || 0) - (i.details.exemptAmount || 0)),
    0
  );

  const activeAssets = assets.filter((a) => !a.disposed && !a.closed);
  const hasForeign = activeAssets.some(
    (a) => a.meta.currency && a.meta.currency !== 'LKR'
  );

  const schedule1Rows = empIncomes.map((i) => ({
    tin: i.details.employerTIN || '',
    employerName: i.details.employerName || '',
    amount: round2((i.details.grossRemuneration || 0) + (i.details.nonCashBenefits || 0)),
  }));

  const schedule2Rows = busIncomes.map((i) => ({
    businessName: i.details.businessName || '',
    amount: round2(i.details.netProfit || 0),
  }));

  const schedule3Rows = [
    ...invIncomes.map((i) => ({
      source: i.details.source || i.type,
      amount: round2(i.details.grossAmount || 0),
    })),
    ...(derivedInterest > 0
      ? [{ source: 'Bank Interest (Derived)', amount: round2(derivedInterest) }]
      : []),
    ...(derivedDividends > 0
      ? [{ source: 'Stock Dividends (Derived)', amount: round2(derivedDividends) }]
      : []),
  ];

  const schedule4Rows = othIncomes.map((i) => ({
    description: i.details.description || i.details.source || i.type,
    amount: round2(i.details.grossAmount || 0),
  }));

  const yearCerts = certificates.filter((c) => !c.taxYear || c.taxYear === currentTaxYear);
  const schedule7Rows = yearCerts.map((c) => ({
    sourceType: c.type,
    tin: c.details.payerTIN || '',
    name: c.details.payerName || '',
    certificateNo: c.certificateNo || '',
    grossAmount: round2(c.details.grossAmount || 0),
    paymentDate: c.paymentDate || '',
    taxDeducted: round2(c.details.taxDeducted || 0),
  }));

  const statement1ARows = activeAssets
    .filter((a) => a.cageCategory === 'A')
    .map((a) => ({
      description: a.meta.address || a.meta.description || '',
      dateAcquired: a.meta.dateAcquired || '',
      cost: round2(a.financials.cost || 0),
      marketValue: round2(a.financials.marketValue || 0),
    }));

  const statement1B1Rows = activeAssets
    .filter((a) => a.cageCategory === 'Bi')
    .map((a) => ({
      description: a.meta.description || `${a.meta.brand || ''} ${a.meta.model || ''}`.trim(),
      regNo: a.meta.regNo || '',
      dateAcquired: a.meta.dateAcquired || '',
      cost: round2(a.financials.marketValue || a.financials.cost || 0),
    }));

  const statement1B2Rows = activeAssets
    .filter((a) => a.cageCategory === 'Bii')
    .map((a) => {
      const yrBal = a.balances?.find(
        (b) => b.taxYear === currentTaxYear || b.taxYear.startsWith(currentTaxYear)
      );
      const closing = yrBal ? yrBal.closingBalance : a.financials.marketValue || 0;
      return {
        bankName: a.meta.bankName || a.meta.description || '',
        accountNo: a.meta.accountNo || '',
        amountInvested: round2(a.financials.cost || closing),
        interest: round2(yrBal ? yrBal.interestEarned || 0 : 0),
        balance: round2(closing),
      };
    });

  const statement1B3Rows = activeAssets
    .filter((a) => a.cageCategory === 'Biii')
    .map((a) => {
      const yrStock = a.stockBalances?.find(
        (s) => s.taxYear === currentTaxYear || s.taxYear.startsWith(currentTaxYear)
      );
      return {
        company: a.meta.companyName || a.meta.brokerName || a.meta.description || '',
        shares: String(a.meta.numberOfShares || yrStock?.holdings?.length || ''),
        dateAcquired: a.meta.dateAcquired || '',
        cost: round2(a.financials.cost || 0),
        dividendIncome: round2(yrStock ? yrStock.dividends || 0 : 0),
      };
    });

  const statement1DRows = liabilities
    .filter((l) => (l.currentBalance || 0) > 0)
    .map((l) => ({
      security: l.securityGiven || l.description || '',
      lender: l.lenderName || '',
      dateIncurred: l.dateAcquired || l.date || '',
      originalAmount: round2(l.originalAmount || l.currentBalance || 0),
      amount: round2(l.currentBalance || 0),
    }));

  return {
    employmentIncome: round2(employmentTotal),
    businessIncome: round2(businessTotal),
    investmentIncome: round2(investmentTotal),
    otherIncome: round2(otherTotal),
    personalRelief: round2(computation.reliefs.personalRelief),
    qualifyingPayments: round2(computation.reliefs.solarRelief || 0),
    hasLocalAssets: activeAssets.length > 0,
    hasForeignAssets: hasForeign,
    ...(schedule1Rows.length > 0 ? { schedule1Rows } : {}),
    ...(schedule2Rows.length > 0 ? { schedule2Rows } : {}),
    ...(schedule3Rows.length > 0 ? { schedule3Rows } : {}),
    ...(schedule4Rows.length > 0 ? { schedule4Rows } : {}),
    ...(schedule7Rows.length > 0 ? { schedule7Rows } : {}),
    ...(statement1ARows.length > 0 ? { statement1ARows } : {}),
    ...(statement1B1Rows.length > 0 ? { statement1B1Rows } : {}),
    ...(statement1B2Rows.length > 0 ? { statement1B2Rows } : {}),
    ...(statement1B3Rows.length > 0 ? { statement1B3Rows } : {}),
    ...(statement1DRows.length > 0 ? { statement1DRows } : {}),
  };
}

/**
 * Generates the complete `javascript:` bookmarklet URI along with the
 * unminified source code for inspection.
 */
export function generateIrdBookmarklet(
  taxData: IrdTaxPayload,
  fieldMap: IrdFieldMapping[] = DEFAULT_RAMIS_FIELD_MAP,
  gridMap: IrdGridMapping[] = DEFAULT_RAMIS_GRID_MAP
): GeneratedBookmarklet {
  const cleanPayload: Record<string, unknown> = {};
  let fieldCount = 0;

  for (const [k, v] of Object.entries(taxData)) {
    if (v !== undefined && v !== null) {
      cleanPayload[k] = v;
      if (Array.isArray(v)) {
        fieldCount += v.length;
      } else {
        fieldCount++;
      }
    }
  }

  const encodedData = encodePayloadUTF8(cleanPayload);
  const unminifiedSource = buildUnminifiedIrdPayloadScript(encodedData, fieldMap, gridMap);
  const minified = minifyBookmarkletScript(unminifiedSource);
  // Encode '%' and '#' so browser bookmark drag/paste never truncates the URI
  const safeBody = minified.replace(/%/g, '%25').replace(/#/g, '%23');
  const uri = `javascript:${safeBody}`;
  const byteSize = new TextEncoder().encode(uri).length;

  return {
    uri,
    unminifiedSource,
    encodedData,
    byteSize,
    fieldCount,
  };
}
