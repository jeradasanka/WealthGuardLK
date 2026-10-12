/**
 * Client-Side In-App Search Utilities
 * Privacy-first, zero-knowledge in-memory search and filtering for taxpayer records.
 */

import type { Asset, Income, AITWHTCertificate } from '@/types';

/**
 * Filter an array of items by a multi-term search query.
 * All whitespace-separated tokens in the query must match somewhere in the item's searchable fields.
 */
export function filterBySearchTerm<T>(
  items: T[],
  query: string,
  fieldExtractor: (item: T) => (string | number | undefined | null | boolean)[]
): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;

  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return items;

  return items.filter((item) => {
    const rawFields = fieldExtractor(item);
    const combinedText = rawFields
      .filter((v): v is string | number => v !== null && v !== undefined)
      .map((v) => String(v).toLowerCase())
      .join(' ');

    return tokens.every((token) => combinedText.includes(token));
  });
}

/**
 * Search certificates across payer name, TIN, cert number, type, and amounts
 */
export function searchCertificates(
  certificates: (AITWHTCertificate | any)[],
  query: string
): (AITWHTCertificate | any)[] {
  return filterBySearchTerm(certificates, query, (c) => [
    c.payerName,
    c.payerTIN,
    c.certificateNumber,
    c.type,
    c.taxYear,
    c.details?.grossAmount,
    c.details?.taxDeducted,
    c.details?.netAmount,
    c.notes,
  ]);
}

/**
 * Search assets across description, category, bank, account number, vehicle number, etc.
 */
export function searchAssets(assets: Asset[], query: string): Asset[] {
  return filterBySearchTerm(assets, query, (a) => [
    a.cageCategory,
    a.meta?.description,
    a.meta?.bankName,
    a.meta?.accountNo,
    a.meta?.address,
    a.meta?.companyName,
    a.meta?.brand,
    a.meta?.model,
    a.meta?.regNo,
    a.meta?.businessName,
    a.financials?.cost,
    a.financials?.marketValue,
  ]);
}

/**
 * Search incomes across schedules (employment, business, investment, other)
 */
export function searchIncomes(incomes: Income[], query: string): Income[] {
  return filterBySearchTerm(incomes, query, (i) => {
    const fields: (string | number | undefined | null)[] = [i.schedule, i.taxYear];
    if (i.schedule === '1') {
      fields.push(
        i.details.employerName,
        i.details.employerTIN,
        i.details.grossRemuneration,
        i.details.apitDeducted
      );
    } else if (i.schedule === '2') {
      fields.push(
        i.details.businessName,
        i.details.grossRevenue,
        i.details.netProfit
      );
    } else if (i.schedule === '3') {
      fields.push(
        i.type,
        i.details.source,
        i.details.grossAmount,
        i.details.whtDeducted
      );
    } else if (i.schedule === '4') {
      fields.push(
        i.type,
        i.details.source,
        i.details.grossAmount,
        i.details.description,
        i.details.currency
      );
    }
    return fields;
  });
}
