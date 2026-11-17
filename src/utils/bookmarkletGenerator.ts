/**
 * Dynamic Bookmarklet Generator for IRD RAMIS Portal
 *
 * Encodes user tax data using UTF-8-safe Base64 and wraps the unminified
 * payload runner into a compact, CSP-safe `javascript:` URI.
 */

import {
  buildUnminifiedIrdPayloadScript,
  DEFAULT_RAMIS_FIELD_MAP,
  type IrdFieldMapping,
} from '@/lib/irdBookmarkletPayload';

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
  /** Allow custom mapped fields for additional RAMIS schedules */
  [key: string]: string | number | boolean | undefined;
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
  /** Number of non-empty fields included in the payload */
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

/**
 * Maps WealthGuardLK tax computation totals into the IRD RAMIS payload shape.
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
  const round2 = (n: number) => Math.round((n || 0) * 100) / 100;
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
 * Generates the complete `javascript:` bookmarklet URI along with the
 * unminified source code for inspection.
 */
export function generateIrdBookmarklet(
  taxData: IrdTaxPayload,
  fieldMap: IrdFieldMapping[] = DEFAULT_RAMIS_FIELD_MAP
): GeneratedBookmarklet {
  const cleanPayload: Record<string, unknown> = {};
  let fieldCount = 0;

  for (const [k, v] of Object.entries(taxData)) {
    if (v !== undefined && v !== null) {
      cleanPayload[k] = v;
      fieldCount++;
    }
  }

  const encodedData = encodePayloadUTF8(cleanPayload);
  const unminifiedSource = buildUnminifiedIrdPayloadScript(encodedData, fieldMap);
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
