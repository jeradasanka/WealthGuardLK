/**
 * Tax Year utilities for Sri Lankan financial year (April 1 - March 31)
 */

/**
 * Get the current tax year based on Sri Lankan financial year
 * Financial year runs from April 1 to March 31
 * Returns the starting year (e.g., "2024" for FY 2024/2025)
 */
export function getCurrentTaxYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed (0 = January, 3 = April)
  
  // If we're in January-March, we're still in the previous year's tax year
  // e.g., March 2025 is in tax year 2024/2025
  if (month < 3) { // January (0), February (1), March (2)
    return (year - 1).toString();
  }
  
  // If we're in April-December, we're in the current year's tax year
  // e.g., April 2025 is in tax year 2025/2026
  return year.toString();
}

/**
 * Format tax year for display (e.g., "2024/2025")
 */
export function formatTaxYear(year: string): string {
  const startYear = parseInt(year);
  const endYear = startYear + 1;
  return `${startYear}/${endYear}`;
}

/**
 * Get the date range for a given tax year
 */
export function getTaxYearDateRange(year: string): { start: Date; end: Date } {
  const startYear = parseInt(year);
  
  return {
    start: new Date(startYear, 3, 1), // April 1 (month is 0-indexed)
    end: new Date(startYear + 1, 2, 31), // March 31 of next year
  };
}

/**
 * Check if a date falls within a specific tax year
 */
export function isDateInTaxYear(date: string | Date, taxYear: string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const { start, end } = getTaxYearDateRange(taxYear);
  
  return dateObj >= start && dateObj <= end;
}

/**
 * Get the tax year for a specific date
 */
export function getTaxYearForDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  
  // If date is in January-March, it belongs to previous year's tax year
  if (month < 3) {
    return (year - 1).toString();
  }
  
  // If date is in April-December, it belongs to current year's tax year
  return year.toString();
}

/**
 * Generate list of recent tax years
 */
export function getRecentTaxYears(count: number = 5): string[] {
  const currentYear = getCurrentTaxYear();
  const years: string[] = [];
  
  for (let i = 0; i < count; i++) {
    years.push((parseInt(currentYear) - i).toString());
  }
  
  return years;
}

/**
 * Generate tax years from a starting year to current year
 */
export function getTaxYearsFromStart(startYear: string): string[] {
  const currentYear = parseInt(getCurrentTaxYear());
  const start = parseInt(startYear);
  const years: string[] = [];
  
  for (let year = currentYear; year >= start; year--) {
    years.push(year.toString());
  }
  
  return years;
}
