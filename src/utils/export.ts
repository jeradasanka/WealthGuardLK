/**
 * Export utilities (FR-11)
 * Handles JSON backup, IRD Schedule 7 CSV, and detailed tax reports
 */

import type { InvestmentIncome, Income, Asset, Liability, TaxEntity } from '@/types';
import { exportData } from './storage';
import { computeTax, formatLKR, calculateTotalIncome, calculateAuditRisk, getTaxBreakdown } from '@/lib/taxEngine';
import { jsPDF } from 'jspdf';

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
  
  // Calculate income breakdown
  const incomeBreakdown = calculateTotalIncome(filteredIncomes);
  
  // Calculate tax (solar investment assumed as 0 for now, could be passed as parameter)
  const taxComputation = computeTax(filteredIncomes, 0);
  
  // Calculate audit risk
  const auditRisk = calculateAuditRisk(
    filteredAssets,
    filteredLiabilities,
    incomes,
    taxYear,
    0 // estimatedLivingExpenses - could be passed as parameter
  );

  // Group incomes by schedule
  const employmentIncomes = filteredIncomes.filter(i => i.schedule === '1');
  const businessIncomes = filteredIncomes.filter(i => i.schedule === '2');
  const investmentIncomes = filteredIncomes.filter(i => i.schedule === '3');

  // Group assets by category
  const immovableProperty = filteredAssets.filter(a => a.cageCategory === 'A');
  const vehicles = filteredAssets.filter(a => a.cageCategory === 'Bi');
  const bankDeposits = filteredAssets.filter(a => a.cageCategory === 'Bii');
  const shares = filteredAssets.filter(a => a.cageCategory === 'Biii');
  const cash = filteredAssets.filter(a => a.cageCategory === 'Biv');
  const loansGiven = filteredAssets.filter(a => a.cageCategory === 'Bv');
  const jewellery = filteredAssets.filter(a => a.cageCategory === 'Bvi');
  const businessProperty = filteredAssets.filter(a => a.cageCategory === 'C');

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
    report += `│ TOTAL EMPLOYMENT INCOME: ${formatLKR(incomeBreakdown.employmentIncome)}\n`;
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
    report += `│ TOTAL BUSINESS INCOME: ${formatLKR(incomeBreakdown.businessIncome)}\n`;
  } else {
    report += `│ No business income declared for this period.\n`;
  }
  report += `└──────────────────────────────────────────────────────────────────────────┘\n\n`;

  report += `┌─ SCHEDULE 3: INVESTMENT INCOME ──────────────────────────────────────────┐\n`;
  if (investmentIncomes.length > 0) {
    investmentIncomes.forEach((income, idx) => {
      const inv = income.details as any;
      const invIncome = income as InvestmentIncome;
      const incomeType = invIncome.type ? 
        (invIncome.type === 'interest' ? 'Interest' : 
         invIncome.type === 'dividend' ? 'Dividend' : 
         invIncome.type === 'rent' ? 'Rent' : 'Mixed') : 
        'Investment';
      report += `
│ ${idx + 1}. Source: ${inv.source || 'Not Specified'}
│    Type:                 ${incomeType}
│    Gross Amount:         ${formatLKR(inv.grossAmount || 0)}
│    WHT Deducted:         ${formatLKR(inv.whtDeducted || 0)}
│    ───────────────────────────────────────────────────────────────────
`;
    });
    report += `│ TOTAL INVESTMENT INCOME: ${formatLKR(incomeBreakdown.investmentIncome)}\n`;
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
    report += `│ \n│ A. IMMOVABLE PROPERTY:\n`;
    immovableProperty.forEach((asset, idx) => {
      report += `│ ${idx + 1}. ${asset.meta.description || 'Property'}\n`;
      report += `│    Acquired:             ${asset.meta.dateAcquired || 'N/A'}\n`;
      report += `│    Cost:                 ${formatLKR(asset.financials.cost)}\n`;
      report += `│    Market Value:         ${formatLKR(asset.financials.marketValue)}\n`;
      report += `│    ───────────────────────────────────────────────────────────────────\n`;
    });
  }

  if (vehicles.length > 0) {
    report += `│ \n│ Bi. MOTOR VEHICLES:\n`;
    vehicles.forEach((asset, idx) => {
      report += `│ ${idx + 1}. ${asset.meta.description || 'Vehicle'}\n`;
      report += `│    Acquired:             ${asset.meta.dateAcquired || 'N/A'}\n`;
      report += `│    Cost:                 ${formatLKR(asset.financials.cost)}\n`;
      report += `│    Market Value:         ${formatLKR(asset.financials.marketValue)}\n`;
      report += `│    ───────────────────────────────────────────────────────────────────\n`;
    });
  }

  if (bankDeposits.length > 0) {
    report += `│ \n│ Bii. BANK BALANCES / TERM DEPOSITS:\n`;
    bankDeposits.forEach((asset, idx) => {
      report += `│ ${idx + 1}. ${asset.meta.description || 'Bank Account'}\n`;
      report += `│    As at:                ${asset.meta.dateAcquired || 'N/A'}\n`;
      report += `│    Balance/Value:        ${formatLKR(asset.financials.marketValue)}\n`;
      report += `│    ───────────────────────────────────────────────────────────────────\n`;
    });
  }

  if (shares.length > 0) {
    report += `│ \n│ Biii. SHARES/STOCKS/SECURITIES:\n`;
    shares.forEach((asset, idx) => {
      report += `│ ${idx + 1}. ${asset.meta.description || 'Shares'}\n`;
      report += `│    Acquired:             ${asset.meta.dateAcquired || 'N/A'}\n`;
      report += `│    Cost:                 ${formatLKR(asset.financials.cost)}\n`;
      report += `│    Market Value:         ${formatLKR(asset.financials.marketValue)}\n`;
      report += `│    ───────────────────────────────────────────────────────────────────\n`;
    });
  }

  if (cash.length > 0) {
    report += `│ \n│ Biv. CASH IN HAND:\n`;
    cash.forEach((asset, idx) => {
      report += `│ ${idx + 1}. ${asset.meta.description || 'Cash'}\n`;
      report += `│    As at:                ${asset.meta.dateAcquired || 'N/A'}\n`;
      report += `│    Amount:               ${formatLKR(asset.financials.marketValue)}\n`;
      report += `│    ───────────────────────────────────────────────────────────────────\n`;
    });
  }

  if (loansGiven.length > 0) {
    report += `│ \n│ Bv. LOANS GIVEN & AMOUNTS RECEIVABLE:\n`;
    loansGiven.forEach((asset, idx) => {
      report += `│ ${idx + 1}. ${asset.meta.description || 'Loan Given'}\n`;
      report += `│    Date:                 ${asset.meta.dateAcquired || 'N/A'}\n`;
      report += `│    Amount:               ${formatLKR(asset.financials.cost)}\n`;
      report += `│    Current Value:        ${formatLKR(asset.financials.marketValue)}\n`;
      report += `│    ───────────────────────────────────────────────────────────────────\n`;
    });
  }

  if (jewellery.length > 0) {
    report += `│ \n│ Bvi. GOLD, SILVER, GEMS, JEWELLERY:\n`;
    jewellery.forEach((asset, idx) => {
      report += `│ ${idx + 1}. ${asset.meta.description || 'Jewellery'}\n`;
      report += `│    Acquired:             ${asset.meta.dateAcquired || 'N/A'}\n`;
      report += `│    Cost:                 ${formatLKR(asset.financials.cost)}\n`;
      report += `│    Market Value:         ${formatLKR(asset.financials.marketValue)}\n`;
      report += `│    ───────────────────────────────────────────────────────────────────\n`;
    });
  }

  if (businessProperty.length > 0) {
    report += `│ \n│ C. PROPERTIES HELD AS PART OF BUSINESS:\n`;
    businessProperty.forEach((asset, idx) => {
      report += `│ ${idx + 1}. ${asset.meta.description || 'Business Property'}\n`;
      report += `│    Acquired:             ${asset.meta.dateAcquired || 'N/A'}\n`;
      report += `│    Cost:                 ${formatLKR(asset.financials.cost)}\n`;
      report += `│    Market Value:         ${formatLKR(asset.financials.marketValue)}\n`;
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

Total Assessable Income:              ${formatLKR(taxComputation.assessableIncome)}

Less: Reliefs
  Personal Relief:                    ${formatLKR(taxComputation.reliefs.personalRelief)}
  Solar Relief:                       ${formatLKR(taxComputation.reliefs.solarRelief)}
                                      ────────────────────
Taxable Income:                       ${formatLKR(taxComputation.taxableIncome)}

Income Tax (Progressive Rates):       ${formatLKR(taxComputation.taxOnIncome)}

Less: Tax Credits
  APIT Deducted:                      ${formatLKR(taxComputation.taxCredits.apit)}
  WHT Deducted:                       ${formatLKR(taxComputation.taxCredits.wht)}
                                      ────────────────────
NET TAX PAYABLE/(REFUNDABLE):         ${formatLKR(taxComputation.taxPayable)}


AUDIT RISK ASSESSMENT
════════════════════════════════════════════════════════════════════════════
Risk Level:                           ${auditRisk.riskLevel.toUpperCase()}
Risk Score:                           ${formatLKR(Math.abs(auditRisk.riskScore))}

Outflows:
  Asset Growth:                       ${formatLKR(auditRisk.assetGrowth)}
  Living Expenses:                    ${formatLKR(auditRisk.estimatedLivingExpenses)}
  Loan Payments:                      ${formatLKR(auditRisk.loanPayments)}
                                      ────────────────────
  Total Outflows:                     ${formatLKR(auditRisk.assetGrowth + auditRisk.estimatedLivingExpenses + auditRisk.loanPayments)}

Inflows:
  Declared Income:                    ${formatLKR(auditRisk.declaredIncome)}
  New Loans:                          ${formatLKR(auditRisk.newLoans)}
                                      ────────────────────
  Total Inflows:                      ${formatLKR(auditRisk.declaredIncome + auditRisk.newLoans)}

Recommendation:                       ${auditRisk.riskLevel === 'safe' ? 'Low Risk - Good Standing' : 
                                       auditRisk.riskLevel === 'warning' ? 'Medium Risk - Review Recommended' : 
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

/**
 * Generates and downloads detailed tax report as PDF
 */
export function downloadDetailedTaxReportPDF(
  entities: TaxEntity[],
  incomes: Income[],
  assets: Asset[],
  liabilities: Liability[],
  taxYear: string,
  isFamily: boolean,
  selectedEntityId?: string
): void {
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
        if (a.ownershipShares && a.ownershipShares.some((s: any) => s.entityId === selectedEntityId)) return true;
        return false;
      });
  
  const filteredLiabilities = isFamily 
    ? liabilities
    : liabilities.filter(l => {
        if (l.ownerId === selectedEntityId) return true;
        if (l.ownershipShares && l.ownershipShares.some((s: any) => s.entityId === selectedEntityId)) return true;
        return false;
      });

  // Calculate totals
  const totalAssets = filteredAssets.reduce((sum, a) => sum + a.financials.marketValue, 0);
  const totalLiabilities = filteredLiabilities.reduce((sum, l) => sum + l.currentBalance, 0);
  
  // Calculate income breakdown
  const incomeBreakdown = calculateTotalIncome(filteredIncomes);
  
  // Calculate tax
  const taxComputation = computeTax(filteredIncomes, 0);
  const taxBreakdown = getTaxBreakdown(taxComputation.taxableIncome, taxYear);
  
  // Calculate audit risk
  const auditRisk = calculateAuditRisk(
    filteredAssets,
    filteredLiabilities,
    incomes,
    taxYear,
    0
  );

  // Group incomes by schedule
  const employmentIncomes = filteredIncomes.filter(i => i.schedule === '1');
  const businessIncomes = filteredIncomes.filter(i => i.schedule === '2');
  const investmentIncomes = filteredIncomes.filter(i => i.schedule === '3');

  // Group assets by category
  const immovableProperty = filteredAssets.filter(a => a.cageCategory === 'A');
  const vehicles = filteredAssets.filter(a => a.cageCategory === 'Bi');
  const bankDeposits = filteredAssets.filter(a => a.cageCategory === 'Bii');
  const shares = filteredAssets.filter(a => a.cageCategory === 'Biii');
  const cash = filteredAssets.filter(a => a.cageCategory === 'Biv');
  const loansGiven = filteredAssets.filter(a => a.cageCategory === 'Bv');
  const jewellery = filteredAssets.filter(a => a.cageCategory === 'Bvi');
  const businessProperty = filteredAssets.filter(a => a.cageCategory === 'C');

  // Create PDF
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const lineHeight = 7;
  let yPos = margin;

  // Helper function to add new page if needed
  const checkPageBreak = (requiredSpace: number = 20) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Header
  doc.setFillColor(41, 98, 255);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PERSONAL INCOME TAX COMPUTATION', pageWidth / 2, 15, { align: 'center' });
  doc.setFontSize(12);
  doc.text('Sri Lankan Inland Revenue Department (IRD)', pageWidth / 2, 23, { align: 'center' });
  doc.text(`Tax Year ${taxYear}/${Number.parseInt(taxYear) + 1}`, pageWidth / 2, 31, { align: 'center' });
  
  yPos = 50;
  doc.setTextColor(0, 0, 0);

  // Taxpayer Information
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TAXPAYER INFORMATION', margin, yPos);
  yPos += lineHeight + 3;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Report Type: ${isFamily ? 'Combined Family Return' : 'Individual Return'}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`${isFamily ? 'Primary Taxpayer' : 'Taxpayer Name'}: ${entity.name}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Tax Identification: ${entity.tin || 'Not Provided'}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`National ID (NIC): ${entity.nic || 'Not Provided'}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Report Generated: ${reportDate}`, margin, yPos);
  yPos += lineHeight;
  doc.text('Generated By: WealthGuard LK v1.0', margin, yPos);
  yPos += lineHeight + 5;

  // Income Summary Section
  checkPageBreak(40);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('INCOME SUMMARY (IRD Schedules 1-3)', margin, yPos);
  yPos += lineHeight + 3;

  // Schedule 1: Employment Income
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHEDULE 1: EMPLOYMENT INCOME', margin + 5, yPos);
  yPos += lineHeight;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (employmentIncomes.length > 0) {
    employmentIncomes.forEach((income, idx) => {
      checkPageBreak(25);
      const emp = income.details as any;
      doc.text(`${idx + 1}. Employer: ${emp.employerName || 'Unknown'}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   Gross Remuneration: ${formatLKR(emp.grossRemuneration || 0)}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   APIT Deducted: ${formatLKR(emp.apitDeducted || 0)}`, margin + 10, yPos);
      yPos += lineHeight + 2;
    });
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL EMPLOYMENT INCOME: ${formatLKR(incomeBreakdown.employmentIncome)}`, margin + 10, yPos);
    yPos += lineHeight + 3;
  } else {
    doc.text('No employment income declared for this period.', margin + 10, yPos);
    yPos += lineHeight + 3;
  }

  // Schedule 2: Business Income
  checkPageBreak(20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHEDULE 2: BUSINESS INCOME', margin + 5, yPos);
  yPos += lineHeight;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (businessIncomes.length > 0) {
    businessIncomes.forEach((income, idx) => {
      checkPageBreak(20);
      const bus = income.details as any;
      doc.text(`${idx + 1}. Business: ${bus.businessName || 'Not Specified'}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   Net Profit: ${formatLKR(bus.netProfit || 0)}`, margin + 10, yPos);
      yPos += lineHeight + 2;
    });
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL BUSINESS INCOME: ${formatLKR(incomeBreakdown.businessIncome)}`, margin + 10, yPos);
    yPos += lineHeight + 3;
  } else {
    doc.text('No business income declared for this period.', margin + 10, yPos);
    yPos += lineHeight + 3;
  }

  // Schedule 3: Investment Income
  checkPageBreak(20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHEDULE 3: INVESTMENT INCOME', margin + 5, yPos);
  yPos += lineHeight;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (investmentIncomes.length > 0) {
    investmentIncomes.forEach((income, idx) => {
      checkPageBreak(20);
      const inv = income.details as any;
      const invIncome = income as InvestmentIncome;
      const incomeType = invIncome.type === 'interest' ? 'Interest' : 
                        invIncome.type === 'dividend' ? 'Dividend' : 
                        invIncome.type === 'rent' ? 'Rent' : 'Mixed';
      doc.text(`${idx + 1}. Source: ${inv.source || 'Not Specified'}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   Type: ${incomeType}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   Gross Amount: ${formatLKR(inv.grossAmount || 0)}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   WHT Deducted: ${formatLKR(inv.whtDeducted || 0)}`, margin + 10, yPos);
      yPos += lineHeight + 2;
    });
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL INVESTMENT INCOME: ${formatLKR(incomeBreakdown.investmentIncome)}`, margin + 10, yPos);
    yPos += lineHeight + 3;
  } else {
    doc.text('No investment income declared for this period.', margin + 10, yPos);
    yPos += lineHeight + 3;
  }

  // Assets Section
  checkPageBreak(30);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`STATEMENT OF ASSETS (As at ${taxYear}-03-31)`, margin, yPos);
  yPos += lineHeight + 3;

  if (immovableProperty.length > 0) {
    doc.setFontSize(12);
    doc.text('A. IMMOVABLE PROPERTY', margin + 5, yPos);
    yPos += lineHeight;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    immovableProperty.forEach((asset, idx) => {
      checkPageBreak(15);
      doc.text(`${idx + 1}. ${asset.name}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   Market Value: ${formatLKR(asset.financials.marketValue)}`, margin + 10, yPos);
      yPos += lineHeight + 2;
    });
  }

  if (vehicles.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Bi. MOTOR VEHICLES', margin + 5, yPos);
    yPos += lineHeight;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    vehicles.forEach((asset, idx) => {
      checkPageBreak(15);
      doc.text(`${idx + 1}. ${asset.name}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   Market Value: ${formatLKR(asset.financials.marketValue)}`, margin + 10, yPos);
      yPos += lineHeight + 2;
    });
  }

  if (bankDeposits.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Bii. BANK BALANCES / TERM DEPOSITS', margin + 5, yPos);
    yPos += lineHeight;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    bankDeposits.forEach((asset, idx) => {
      checkPageBreak(15);
      doc.text(`${idx + 1}. ${asset.name}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   Market Value: ${formatLKR(asset.financials.marketValue)}`, margin + 10, yPos);
      yPos += lineHeight + 2;
    });
  }

  if (shares.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Biii. SHARES/STOCKS/SECURITIES', margin + 5, yPos);
    yPos += lineHeight;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    shares.forEach((asset, idx) => {
      checkPageBreak(15);
      doc.text(`${idx + 1}. ${asset.name}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   Market Value: ${formatLKR(asset.financials.marketValue)}`, margin + 10, yPos);
      yPos += lineHeight + 2;
    });
  }

  if (cash.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Biv. CASH IN HAND', margin + 5, yPos);
    yPos += lineHeight;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    cash.forEach((asset, idx) => {
      checkPageBreak(15);
      doc.text(`${idx + 1}. ${asset.name}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   Amount: ${formatLKR(asset.financials.marketValue)}`, margin + 10, yPos);
      yPos += lineHeight + 2;
    });
  }

  if (loansGiven.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Bv. LOANS GIVEN & AMOUNTS RECEIVABLE', margin + 5, yPos);
    yPos += lineHeight;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    loansGiven.forEach((asset, idx) => {
      checkPageBreak(15);
      doc.text(`${idx + 1}. ${asset.name}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   Amount: ${formatLKR(asset.financials.marketValue)}`, margin + 10, yPos);
      yPos += lineHeight + 2;
    });
  }

  if (jewellery.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Bvi. GOLD, SILVER, GEMS, JEWELLERY', margin + 5, yPos);
    yPos += lineHeight;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    jewellery.forEach((asset, idx) => {
      checkPageBreak(15);
      doc.text(`${idx + 1}. ${asset.name}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   Market Value: ${formatLKR(asset.financials.marketValue)}`, margin + 10, yPos);
      yPos += lineHeight + 2;
    });
  }

  if (businessProperty.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('C. PROPERTIES HELD AS PART OF BUSINESS', margin + 5, yPos);
    yPos += lineHeight;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    businessProperty.forEach((asset, idx) => {
      checkPageBreak(15);
      doc.text(`${idx + 1}. ${asset.name}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   Market Value: ${formatLKR(asset.financials.marketValue)}`, margin + 10, yPos);
      yPos += lineHeight + 2;
    });
  }

  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL ASSETS: ${formatLKR(totalAssets)}`, margin + 5, yPos);
  yPos += lineHeight + 5;

  // Liabilities Section
  checkPageBreak(20);
  doc.setFontSize(14);
  doc.text('LIABILITIES', margin, yPos);
  yPos += lineHeight + 3;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (filteredLiabilities.length > 0) {
    filteredLiabilities.forEach((liability, idx) => {
      checkPageBreak(15);
      doc.text(`${idx + 1}. ${liability.description}`, margin + 10, yPos);
      yPos += lineHeight;
      doc.text(`   Current Balance: ${formatLKR(liability.currentBalance)}`, margin + 10, yPos);
      yPos += lineHeight + 2;
    });
  } else {
    doc.text('No liabilities declared.', margin + 10, yPos);
    yPos += lineHeight;
  }

  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL LIABILITIES: ${formatLKR(totalLiabilities)}`, margin + 5, yPos);
  yPos += lineHeight;
  doc.text(`NET WORTH: ${formatLKR(totalAssets - totalLiabilities)}`, margin + 5, yPos);
  yPos += lineHeight + 5;

  // Tax Computation Section
  checkPageBreak(50);
  doc.setFontSize(14);
  doc.text('TAX COMPUTATION', margin, yPos);
  yPos += lineHeight + 3;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Assessable Income: ${formatLKR(taxComputation.assessableIncome)}`, margin + 5, yPos);
  yPos += lineHeight + 2;
  
  doc.text('Less: Reliefs', margin + 5, yPos);
  yPos += lineHeight;
  doc.text(`  Personal Relief: ${formatLKR(taxComputation.reliefs.personalRelief)}`, margin + 10, yPos);
  yPos += lineHeight;
  doc.text(`  Solar Relief: ${formatLKR(taxComputation.reliefs.solarRelief)}`, margin + 10, yPos);
  yPos += lineHeight + 2;
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Taxable Income: ${formatLKR(taxComputation.taxableIncome)}`, margin + 5, yPos);
  yPos += lineHeight + 2;
  
  doc.setFont('helvetica', 'normal');
  doc.text('Income Tax Calculation:', margin + 5, yPos);
  yPos += lineHeight;
  
  taxBreakdown.forEach((bracket: { range: string; rate: string; amount: number; tax: number }) => {
    checkPageBreak(10);
    doc.text(`  ${bracket.range} @ ${bracket.rate}: ${formatLKR(bracket.tax)}`, margin + 10, yPos);
    yPos += lineHeight;
  });
  
  doc.setFont('helvetica', 'bold');
  doc.text(`  Total Tax on Income: ${formatLKR(taxComputation.taxOnIncome)}`, margin + 10, yPos);
  yPos += lineHeight + 2;
  
  doc.setFont('helvetica', 'normal');
  doc.text('Less: Tax Credits', margin + 5, yPos);
  yPos += lineHeight;
  doc.text(`  APIT Deducted: ${formatLKR(taxComputation.taxCredits.apit)}`, margin + 10, yPos);
  yPos += lineHeight;
  doc.text(`  WHT Deducted: ${formatLKR(taxComputation.taxCredits.wht)}`, margin + 10, yPos);
  yPos += lineHeight + 2;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`NET TAX PAYABLE: ${formatLKR(taxComputation.taxPayable)}`, margin + 5, yPos);
  yPos += lineHeight + 5;

  // Audit Risk Assessment
  checkPageBreak(70); // Increased space needed for detailed breakdown
  doc.setFontSize(14);
  doc.text('AUDIT RISK ASSESSMENT', margin, yPos);
  yPos += lineHeight + 3;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const riskColor = auditRisk.riskLevel === 'safe' ? [34, 197, 94] : 
                    auditRisk.riskLevel === 'warning' ? [234, 179, 8] : [239, 68, 68];
  doc.setTextColor(riskColor[0], riskColor[1], riskColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(`Risk Level: ${auditRisk.riskLevel.toUpperCase()}`, margin + 5, yPos);
  yPos += lineHeight;
  
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(`Risk Score: ${formatLKR(Math.abs(auditRisk.riskScore))}`, margin + 5, yPos);
  yPos += lineHeight + 3;

  // Outflows section
  doc.setFont('helvetica', 'bold');
  doc.text('Outflows:', margin + 5, yPos);
  yPos += lineHeight;
  doc.setFont('helvetica', 'normal');
  doc.text(`Asset Growth:`, margin + 10, yPos);
  doc.text(formatLKR(auditRisk.assetGrowth), margin + 90, yPos);
  yPos += lineHeight;
  doc.text(`Living Expenses:`, margin + 10, yPos);
  doc.text(formatLKR(auditRisk.estimatedLivingExpenses), margin + 90, yPos);
  yPos += lineHeight;
  doc.text(`Loan Payments:`, margin + 10, yPos);
  doc.text(formatLKR(auditRisk.loanPayments), margin + 90, yPos);
  yPos += lineHeight;
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Outflows:`, margin + 10, yPos);
  doc.text(formatLKR(auditRisk.assetGrowth + auditRisk.estimatedLivingExpenses + auditRisk.loanPayments), margin + 90, yPos);
  yPos += lineHeight + 2;

  // Inflows section
  doc.setFont('helvetica', 'bold');
  doc.text('Inflows:', margin + 5, yPos);
  yPos += lineHeight;
  doc.setFont('helvetica', 'normal');
  doc.text(`Declared Income:`, margin + 10, yPos);
  doc.text(formatLKR(auditRisk.totalIncome), margin + 90, yPos);
  yPos += lineHeight;
  doc.text(`Less: Tax Deducted:`, margin + 10, yPos);
  doc.text(`- ${formatLKR(auditRisk.taxDeducted)}`, margin + 90, yPos);
  yPos += lineHeight;
  doc.text(`New Loans:`, margin + 10, yPos);
  doc.text(formatLKR(auditRisk.newLoans), margin + 90, yPos);
  yPos += lineHeight;
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Inflows:`, margin + 10, yPos);
  doc.text(formatLKR(auditRisk.totalIncome - auditRisk.taxDeducted + auditRisk.newLoans), margin + 90, yPos);
  yPos += lineHeight + 3;
  
  doc.setFont('helvetica', 'normal');
  const recommendation = auditRisk.riskLevel === 'safe' ? 'Low Risk - Good Standing' : 
                        auditRisk.riskLevel === 'warning' ? 'Medium Risk - Review Recommended' : 
                        'High Risk - Immediate Attention Required';
  doc.text(`Recommendation: ${recommendation}`, margin + 5, yPos);
  yPos += lineHeight + 5;

  // Disclaimer
  checkPageBreak(35);
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 30, 'F');
  yPos += 5;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DISCLAIMER', margin + 5, yPos);
  yPos += lineHeight - 1;
  
  doc.setFont('helvetica', 'normal');
  const disclaimerLines = doc.splitTextToSize(
    'This report is generated for personal tax planning purposes only and does not constitute official tax advice. Please consult with a qualified tax professional before filing your income tax return with the Inland Revenue Department of Sri Lanka.',
    pageWidth - 2 * margin - 10
  );
  disclaimerLines.forEach((line: string) => {
    doc.text(line, margin + 5, yPos);
    yPos += 5;
  });
  
  yPos += 5;
  doc.setFontSize(8);
  doc.text(`Generated by WealthGuard LK - Report Date: ${reportDate}`, margin + 5, yPos);

  // Save PDF
  const reportType = isFamily ? 'FAMILY' : 'INDIVIDUAL';
  const filename = `IRD_TAX_REPORT_${reportType}_${entity.tin || 'NOTAX'}_${taxYear}.pdf`;
  doc.save(filename);
}

