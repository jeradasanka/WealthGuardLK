/**
 * Export utilities (FR-11)
 * Handles JSON backup and IRD Schedule 7 CSV generation
 */

import type { InvestmentIncome } from '@/types';
import { exportData } from './storage';

/**
 * Downloads encrypted JSON backup
 */
export async function downloadBackup(passphrase: string, fileName?: string): Promise<void> {
  try {
    const blob = await exportData(passphrase);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || `wealthguard_backup_${new Date().toISOString().split('T')[0]}.wglk`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export failed:', error);
    throw new Error('Failed to export data');
  }
}

/**
 * Generates IRD Schedule 7 CSV for WHT certificates
 * Format: [TIN]_IIT_WHTSCHEDULE_2425_ORIGINAL_V1.csv
 */
export function generateSchedule7CSV(
  investmentIncomes: InvestmentIncome[],
  taxYear: string,
  taxpayerTIN: string
): string {
  // Filter only investment incomes with WHT
  const whtIncomes = investmentIncomes.filter((income) => income.details.whtDeducted > 0);

  if (whtIncomes.length === 0) {
    throw new Error('No WHT deductions found for export');
  }

  // CSV Headers as per IRD requirements
  const headers = [
    'Serial No',
    'Income Source',
    'Income Type',
    'Gross Amount (Rs.)',
    'WHT Deducted (Rs.)',
    'WHT Certificate No',
    'Date',
  ];

  // Generate CSV rows
  const rows = whtIncomes.map((income, index) => {
    const incomeType = income.type === 'interest' ? 'Interest Income' : 
                      income.type === 'dividend' ? 'Dividend Income' : 
                      'Rental Income';
    
    return [
      String(index + 1),
      income.details.source,
      incomeType,
      income.details.grossAmount.toFixed(2),
      income.details.whtDeducted.toFixed(2),
      '', // Certificate number to be filled manually
      '', // Date to be filled manually
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Downloads Schedule 7 CSV file
 */
export function downloadSchedule7CSV(
  investmentIncomes: InvestmentIncome[],
  taxYear: string,
  taxpayerTIN: string
): void {
  try {
    const csv = generateSchedule7CSV(investmentIncomes, taxYear, taxpayerTIN);
    
    // Format year for filename (e.g., 2024/2025 -> 2425)
    const yearCode = taxYear.slice(2, 4) + (parseInt(taxYear.slice(2, 4)) + 1);
    const filename = `${taxpayerTIN}_IIT_WHTSCHEDULE_${yearCode}_ORIGINAL_V1.csv`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('CSV export failed:', error);
    throw error;
  }
}

/**
 * Generates a summary report as plain text
 */
export function generateSummaryReport(
  entityName: string,
  tin: string,
  taxYear: string,
  totalIncome: number,
  totalAssets: number,
  totalLiabilities: number,
  taxPayable: number
): string {
  const report = `
WEALTHGUARD LK - TAX SUMMARY REPORT
====================================

Taxpayer: ${entityName}
TIN: ${tin}
Tax Year: ${taxYear}
Generated: ${new Date().toLocaleString()}

INCOME SUMMARY
--------------
Total Declared Income: Rs. ${totalIncome.toLocaleString('en-LK', { minimumFractionDigits: 2 })}

ASSETS & LIABILITIES
--------------------
Total Assets: Rs. ${totalAssets.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
Total Liabilities: Rs. ${totalLiabilities.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
Net Worth: Rs. ${(totalAssets - totalLiabilities).toLocaleString('en-LK', { minimumFractionDigits: 2 })}

TAX COMPUTATION
---------------
Tax Payable: Rs. ${taxPayable.toLocaleString('en-LK', { minimumFractionDigits: 2 })}

====================================
This report is generated for personal reference only.
Always consult with a qualified tax professional before filing.
  `.trim();

  return report;
}

/**
 * Downloads summary report as text file
 */
export function downloadSummaryReport(reportContent: string, tin: string, taxYear: string): void {
  const filename = `tax_summary_${tin}_${taxYear}.txt`;
  const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
