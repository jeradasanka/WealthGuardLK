/**
 * Export utilities (FR-11)
 * Handles JSON backup, IRD Schedule 7 CSV, and detailed tax reports
 */

import type { InvestmentIncome, Income, Asset, Liability, TaxEntity } from '@/types';
import { exportData } from './storage';
import { computeTax, formatLKR } from '@/lib/taxEngine';

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

/**
 * Generates detailed IRD-compliant tax report
 */
export function generateDetailedTaxReport(
  entities: TaxEntity[],
  incomes: Income[],
  assets: Asset[],
  liabilities: Liability[],
  taxYear: string,
  isFamily: boolean,
  selectedEntityId?: string
): string {
  const entity = isFamily ? entities[0] : entities.find(e => e.id === selectedEntityId) || entities[0];
  const reportDate = new Date().toLocaleDateString('en-LK', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Filter data based on selection
  const filteredIncomes = isFamily 
    ? incomes.filter(i => i.taxYear === taxYear)
    : incomes.filter(i => i.ownerId === selectedEntityId && i.taxYear === taxYear);
  
  const filteredAssets = isFamily 
    ? assets.filter(a => !a.disposed)
    : assets.filter(a => {
        if (a.disposed) return false;
        if (a.ownerId === selectedEntityId) return true;
        if (a.ownershipShares && a.ownershipShares.some(s => s.entityId === selectedEntityId)) return true;
        return false;
      });
  
  const filteredLiabilities = isFamily 
    ? liabilities
    : liabilities.filter(l => {
        if (l.ownerId === selectedEntityId) return true;
        if (l.ownershipShares && l.ownershipShares.some(s => s.entityId === selectedEntityId)) return true;
        return false;
      });

  // Calculate totals
  const totalAssets = filteredAssets.reduce((sum, a) => sum + a.financials.marketValue, 0);
  const totalLiabilities = filteredLiabilities.reduce((sum, l) => sum + l.currentBalance, 0);
  const taxComputation = computeTax(filteredIncomes, totalAssets, totalLiabilities, filteredAssets, filteredLiabilities, 1200000);

  // Group incomes by schedule
  const employmentIncomes = filteredIncomes.filter(i => i.schedule === '1');
  const businessIncomes = filteredIncomes.filter(i => i.schedule === '2');
  const investmentIncomes = filteredIncomes.filter(i => i.schedule === '3');

  // Group assets by category
  const immovableProperty = filteredAssets.filter(a => a.cageCategory === '701');
  const vehicles = filteredAssets.filter(a => a.cageCategory === '711');
  const financialAssets = filteredAssets.filter(a => a.cageCategory === '721');

  let report = `
╔═══════════════════════════════════════════════════════════════════════════╗
║                    PERSONAL INCOME TAX COMPUTATION                        ║
║              Sri Lankan Inland Revenue Department (IRD)                   ║
║                    Tax Year ${taxYear}/${parseInt(taxYear) + 1}                              ║
╚═══════════════════════════════════════════════════════════════════════════╝

TAXPAYER INFORMATION
════════════════════════════════════════════════════════════════════════════
Report Type:          ${isFamily ? 'Combined Family Return' : 'Individual Return'}
${isFamily ? `Primary Taxpayer:     ${entity.name}` : `Taxpayer Name:        ${entity.name}`}
Tax Identification:   ${entity.tin || 'Not Provided'}
National ID (NIC):    ${entity.nic || 'Not Provided'}
Report Generated:     ${reportDate}
Generated By:         WealthGuard LK v1.0


INCOME SUMMARY (IRD Schedules 1-3)
════════════════════════════════════════════════════════════════════════════

┌─ SCHEDULE 1: EMPLOYMENT INCOME ──────────────────────────────────────────┐
`;

  if (employmentIncomes.length > 0) {
    employmentIncomes.forEach((income, idx) => {
      const emp = income.details as any;
      report += `
│ ${idx + 1}. Employer: ${emp.employerName || 'Unknown'}
│    Employer TIN:         ${emp.employerTIN || 'N/A'}
│    Gross Remuneration:   ${formatLKR(emp.grossRemuneration || 0)}
│    Non-Cash Benefits:    ${formatLKR(emp.nonCashBenefits || 0)}
│    Exempt Income:        ${formatLKR(emp.exemptIncome || 0)}
│    APIT Deducted:        ${formatLKR(emp.apitDeducted || 0)}
│    ───────────────────────────────────────────────────────────────────
`;
    });
    report += `│ TOTAL EMPLOYMENT INCOME: ${formatLKR(taxComputation.employmentIncome)}\n`;
  } else {
    report += `│ No employment income declared for this period.\n`;
  }
  report += `└──────────────────────────────────────────────────────────────────────────┘\n\n`;

  report += `┌─ SCHEDULE 2: BUSINESS INCOME ────────────────────────────────────────────┐\n`;
  if (businessIncomes.length > 0) {
    businessIncomes.forEach((income, idx) => {
      const bus = income.details as any;
      report += `
│ ${idx + 1}. Business Name: ${bus.businessName || 'Not Specified'}
│    Gross Revenue:        ${formatLKR(bus.grossRevenue || 0)}
│    Direct Expenses:      ${formatLKR(bus.directExpenses || 0)}
│    Net Profit (Cage 203):${formatLKR(bus.netProfit || 0)}
│    ───────────────────────────────────────────────────────────────────
`;
    });
    report += `│ TOTAL BUSINESS INCOME: ${formatLKR(taxComputation.businessIncome)}\n`;
  } else {
    report += `│ No business income declared for this period.\n`;
  }
  report += `└──────────────────────────────────────────────────────────────────────────┘\n\n`;

  report += `┌─ SCHEDULE 3: INVESTMENT INCOME ──────────────────────────────────────────┐\n`;
  if (investmentIncomes.length > 0) {
    investmentIncomes.forEach((income, idx) => {
      const inv = income.details as any;
      const incomeType = income.type === 'investment' ? 
        (inv.interest > 0 ? 'Interest' : inv.dividends > 0 ? 'Dividend' : inv.rent > 0 ? 'Rent' : 'Mixed') : 
        'Investment';
      report += `
│ ${idx + 1}. Source: ${inv.source || 'Not Specified'}
│    Type:                 ${incomeType}
│    Gross Amount:         ${formatLKR(inv.grossAmount || 0)}
│    WHT Deducted:         ${formatLKR(inv.whtDeducted || 0)}
│    ───────────────────────────────────────────────────────────────────
`;
    });
    report += `│ TOTAL INVESTMENT INCOME: ${formatLKR(taxComputation.investmentIncome)}\n`;
  } else {
    report += `│ No investment income declared for this period.\n`;
  }
  report += `└──────────────────────────────────────────────────────────────────────────┘\n\n`;

  report += `
STATEMENT OF ASSETS AND LIABILITIES (As at ${taxYear}-03-31)
════════════════════════════════════════════════════════════════════════════

┌─ ASSETS ─────────────────────────────────────────────────────────────────┐
`;

  if (immovableProperty.length > 0) {
    report += `│ \n│ IMMOVABLE PROPERTY (Cage 701):\n`;
    immovableProperty.forEach((asset, idx) => {
      report += `│ ${idx + 1}. ${asset.meta.description || 'Property'}\n`;
      report += `│    Acquired:             ${asset.meta.dateAcquired || 'N/A'}\n`;
      report += `│    Cost:                 ${formatLKR(asset.financials.cost)}\n`;
      report += `│    Market Value:         ${formatLKR(asset.financials.marketValue)}\n`;
      report += `│    ───────────────────────────────────────────────────────────────────\n`;
    });
  }

  if (vehicles.length > 0) {
    report += `│ \n│ MOTOR VEHICLES (Cage 711):\n`;
    vehicles.forEach((asset, idx) => {
      report += `│ ${idx + 1}. ${asset.meta.description || 'Vehicle'}\n`;
      report += `│    Acquired:             ${asset.meta.dateAcquired || 'N/A'}\n`;
      report += `│    Cost:                 ${formatLKR(asset.financials.cost)}\n`;
      report += `│    Market Value:         ${formatLKR(asset.financials.marketValue)}\n`;
      report += `│    ───────────────────────────────────────────────────────────────────\n`;
    });
  }

  if (financialAssets.length > 0) {
    report += `│ \n│ BANK ACCOUNTS & FINANCIAL ASSETS (Cage 721):\n`;
    financialAssets.forEach((asset, idx) => {
      report += `│ ${idx + 1}. ${asset.meta.description || 'Financial Asset'}\n`;
      report += `│    As at:                ${asset.meta.dateAcquired || 'N/A'}\n`;
      report += `│    Balance/Value:        ${formatLKR(asset.financials.marketValue)}\n`;
      report += `│    ───────────────────────────────────────────────────────────────────\n`;
    });
  }

  report += `│ \n│ TOTAL ASSETS:            ${formatLKR(totalAssets)}\n`;
  report += `└──────────────────────────────────────────────────────────────────────────┘\n\n`;

  report += `┌─ LIABILITIES ────────────────────────────────────────────────────────────┐\n`;
  if (filteredLiabilities.length > 0) {
    filteredLiabilities.forEach((liability, idx) => {
      report += `│ ${idx + 1}. ${liability.description || 'Loan'}\n`;
      report += `│    Lender:               ${liability.lenderName}\n`;
      report += `│    Original Amount:      ${formatLKR(liability.originalAmount)}\n`;
      report += `│    Current Balance:      ${formatLKR(liability.currentBalance)}\n`;
      report += `│    ───────────────────────────────────────────────────────────────────\n`;
    });
  } else {
    report += `│ No liabilities declared.\n`;
  }
  report += `│ \n│ TOTAL LIABILITIES:       ${formatLKR(totalLiabilities)}\n`;
  report += `│ NET WORTH:               ${formatLKR(totalAssets - totalLiabilities)}\n`;
  report += `└──────────────────────────────────────────────────────────────────────────┘\n\n`;

  report += `
TAX COMPUTATION
════════════════════════════════════════════════════════════════════════════

Total Assessable Income:              ${formatLKR(taxComputation.totalIncome)}

Less: Reliefs
  Personal Relief:                    ${formatLKR(1200000)}
  Solar Relief:                       ${formatLKR(taxComputation.solarRelief)}
                                      ────────────────────
Taxable Income:                       ${formatLKR(taxComputation.taxableIncome)}

Income Tax (Progressive Rates):       ${formatLKR(taxComputation.incomeTax)}

Less: Tax Credits
  APIT Deducted:                      ${formatLKR(taxComputation.totalAPIT)}
  WHT Deducted:                       ${formatLKR(taxComputation.totalWHT)}
                                      ────────────────────
NET TAX PAYABLE/(REFUNDABLE):         ${formatLKR(taxComputation.finalTaxPayable)}


AUDIT RISK ASSESSMENT
════════════════════════════════════════════════════════════════════════════
Risk Level:                           ${taxComputation.auditRisk.level.toUpperCase()}
Risk Score:                           ${formatLKR(Math.abs(taxComputation.auditRisk.unexplainedWealth))}
Recommendation:                       ${taxComputation.auditRisk.level === 'green' ? 'Low Risk - Good Standing' : 
                                       taxComputation.auditRisk.level === 'yellow' ? 'Medium Risk - Review Recommended' : 
                                       'High Risk - Immediate Attention Required'}


════════════════════════════════════════════════════════════════════════════
DISCLAIMER
────────────────────────────────────────────────────────────────────────────
This report is generated for personal tax planning purposes only and does
not constitute official tax advice. Please consult with a qualified tax
professional before filing your income tax return with the Inland Revenue
Department of Sri Lanka.

Generated by WealthGuard LK - Zero-Knowledge Tax Tracker
Report Date: ${reportDate}
════════════════════════════════════════════════════════════════════════════
`;

  return report.trim();
}

/**
 * Downloads detailed tax report as text file
 */
export function downloadDetailedTaxReport(
  entities: TaxEntity[],
  incomes: Income[],
  assets: Asset[],
  liabilities: Liability[],
  taxYear: string,
  isFamily: boolean,
  selectedEntityId?: string
): void {
  const report = generateDetailedTaxReport(
    entities,
    incomes,
    assets,
    liabilities,
    taxYear,
    isFamily,
    selectedEntityId
  );
  
  const entity = isFamily ? entities[0] : entities.find(e => e.id === selectedEntityId) || entities[0];
  const reportType = isFamily ? 'FAMILY' : 'INDIVIDUAL';
  const filename = `IRD_TAX_REPORT_${reportType}_${entity.tin || 'NOTAX'}_${taxYear}.txt`;
  
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

