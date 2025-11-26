import { ParsedTaxData } from '@/types/import';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker using jsdelivr CDN (works better with CORS)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

/**
 * Parse PDF buffer and extract tax-related data
 * This is a placeholder that will be enhanced based on actual PDF structure
 */
export async function parseTaxPDF(file: File): Promise<ParsedTaxData> {
  try {
    // For browser environment, we'll use a different approach
    // Instead of pdf-parse (which is Node.js), we'll extract text using PDF.js or manual parsing
    
    console.log('Starting PDF parsing for file:', file.name);
    
    const text = await extractTextFromPDF(file);
    
    console.log('Extracted PDF text (full):', text); // Debug: show full text
    console.log('Text length:', text.length);
    
    // Extract tax year from filename or content
    const taxYear = extractTaxYear(text, file.name);
    
    console.log('Detected tax year:', taxYear); // Debug
    
    // Parse different sections
    const parsedData: ParsedTaxData = {
      taxYear,
      taxpayerInfo: extractTaxpayerInfo(text),
      employmentIncome: extractEmploymentIncome(text),
      businessIncome: extractBusinessIncome(text),
      investmentIncome: extractInvestmentIncome(text),
      assets: extractAssets(text),
      liabilities: extractLiabilities(text),
    };
    
    console.log('Parsed data:', parsedData); // Debug: show parsed result
    
    return parsedData;
  } catch (error) {
    console.error('Detailed error parsing PDF:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw new Error('Failed to parse PDF file. Please ensure it is a valid RAMIS tax return.');
  }
}

async function extractTextFromPDF(file: File): Promise<string> {
  try {
    console.log('Reading PDF file...');
    
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log('ArrayBuffer size:', arrayBuffer.byteLength);
    
    // Load PDF document
    console.log('Loading PDF document...');
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    
    const pdf = await loadingTask.promise;
    console.log('PDF loaded. Number of pages:', pdf.numPages);
    
    let fullText = '';
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`Extracting text from page ${pageNum}...`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      console.log(`Page ${pageNum} has ${textContent.items.length} text items`);
      
      // Combine all text items with spaces
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n';
    }
    
    console.log('Total extracted text length:', fullText.length);
    
    return fullText;
  } catch (error) {
    console.error('Detailed error extracting text from PDF:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
    }
    throw error;
  }
}

function extractTaxYear(text: string, filename: string): string {
  // Try to extract year from "Year of assessment" field
  const yearMatch = text.match(/Year of assessment\s+(\d{4})\/(\d{4})/i);
  if (yearMatch) {
    return yearMatch[1]; // Return first year (e.g., 2023 from 2023/2024)
  }
  
  // Try to extract from filename first (e.g., "RAMIS 2024.pdf")
  const filenameMatch = filename.match(/20\d{2}/);
  if (filenameMatch) {
    return filenameMatch[0];
  }
  
  // Default to current tax year
  const now = new Date();
  const month = now.getMonth();
  return month < 3 ? (now.getFullYear() - 1).toString() : now.getFullYear().toString();
}

function extractTaxpayerInfo(text: string) {
  const nameMatch = text.match(/Name of taxpayer\s+([A-Z\s]+?)(?:\s+Year of assessment|$)/i);
  const tinMatch = text.match(/Taxpayer Identification\s+Number \(TIN\)\s+(\d+)/i);
  const nicMatch = text.match(/National Identity card\s+number.*?(\d{9}[VvXx]|\d{12})/i);
  
  return {
    name: nameMatch?.[1]?.trim(),
    tin: tinMatch?.[1]?.trim(),
    nic: nicMatch?.[1]?.trim(),
  };
}

function extractEmploymentIncome(text: string) {
  const incomes = [];
  
  // Look for Primary Employment section
  const employerNameMatch = text.match(/Employer\/company name\s+([A-Z\s&\.]+?)(?:\s+Remuneration|$)/i);
  const employerTINMatch = text.match(/TIN of the employer\s+(\d+)/i);
  const remunerationMatch = text.match(/Remuneration \(Rs\.\)\s+([\d,]+\.?\d*)/i);
  const apitMatch = text.match(/APIT paid on Employment\s+income \(Rs\.\)\s+([\d,]+\.?\d*)/i);
  const exemptMatch = text.match(/Total exempt \/ Excluded\s+employment income \(Rs\.\)\s+([\d,]+\.?\d*)/i);
  
  if (employerNameMatch || remunerationMatch) {
    incomes.push({
      employerName: employerNameMatch?.[1]?.trim() || 'Unknown Employer',
      employerTIN: employerTINMatch?.[1]?.trim(),
      grossRemuneration: parseAmount(remunerationMatch?.[1]),
      nonCashBenefits: 0,
      apitDeducted: parseAmount(apitMatch?.[1]),
      exemptIncome: parseAmount(exemptMatch?.[1]),
    });
  }
  
  return incomes;
}

function extractBusinessIncome(text: string) {
  const incomes = [];
  
  const businessSection = text.match(/(?:Schedule\s*2|Business Income|Gains and Profits)(.*?)(?:Schedule\s*3|Investment Income|$)/is);
  
  if (businessSection) {
    const section = businessSection[1];
    
    const nameMatch = section.match(/(?:Business Name|Trade Name)\s*[:\-]?\s*([A-Za-z\s&\.]+?)(?:\n|Revenue)/i);
    const revenueMatch = section.match(/(?:Gross Revenue|Cage 201)\s*[:\-]?\s*Rs?\.?\s*([\d,]+(?:\.\d{2})?)/i);
    const expensesMatch = section.match(/(?:Direct Expenses|Cage 202)\s*[:\-]?\s*Rs?\.?\s*([\d,]+(?:\.\d{2})?)/i);
    const profitMatch = section.match(/(?:Net Profit|Cage 203)\s*[:\-]?\s*Rs?\.?\s*([\d,]+(?:\.\d{2})?)/i);
    
    if (nameMatch || revenueMatch) {
      const revenue = parseAmount(revenueMatch?.[1]);
      const expenses = parseAmount(expensesMatch?.[1]);
      
      incomes.push({
        businessName: nameMatch?.[1]?.trim() || 'Unknown Business',
        grossRevenue: revenue,
        directExpenses: expenses,
        netProfit: parseAmount(profitMatch?.[1]) || (revenue - expenses),
      });
    }
  }
  
  return incomes;
}

function extractInvestmentIncome(text: string) {
  const incomes = [];
  
  // 1. Interest Income
  // Pattern: I-INTEREST [Cage] [Cage] [Amount]
  // Also look for WHT if available in the same line or section
  const interestMatches = text.matchAll(/I-INTEREST\s+(?:.*?)\s+([\d,]+\.?\d*)/gi);
  let totalInterest = 0;
  for (const match of interestMatches) {
    // Ensure we're capturing the amount column, not a cage number
    // Amounts usually have commas or decimals, cage numbers usually don't (unless they are 3 digits)
    // This is a heuristic.
    const amount = parseAmount(match[1]);
    if (amount > 1000) { // Filter out likely cage numbers
       totalInterest += amount;
    }
  }
  
  if (totalInterest > 0) {
    incomes.push({
      source: 'Bank Interest',
      dividends: 0,
      interest: totalInterest,
      rent: 0,
      wht: 0, // Placeholder, hard to extract WHT without column structure
    });
  }

  // 2. Dividend Income
  const dividendMatches = text.matchAll(/D-DIVIDEND\s+(?:.*?)\s+([\d,]+\.?\d*)/gi);
  let totalDividend = 0;
  for (const match of dividendMatches) {
    const amount = parseAmount(match[1]);
    if (amount > 1000) {
      totalDividend += amount;
    }
  }

  if (totalDividend > 0) {
    incomes.push({
      source: 'Dividend Income',
      dividends: totalDividend,
      interest: 0,
      rent: 0,
      wht: 0,
    });
  }

  // 3. Rent Income
  const rentMatches = text.matchAll(/R-RENT\s+(?:.*?)\s+([\d,]+\.?\d*)/gi);
  let totalRent = 0;
  for (const match of rentMatches) {
    const amount = parseAmount(match[1]);
    if (amount > 1000) {
      totalRent += amount;
    }
  }

  if (totalRent > 0) {
    incomes.push({
      source: 'Rent Income',
      dividends: 0,
      interest: 0,
      rent: totalRent,
      wht: 0,
    });
  }
  
  return incomes;
}

function extractAssets(text: string) {
  const assets = [];
  
  // Extract immovable property (land/house)
  // Pattern: A 1 [Description] [Date] [Cost] [Market Value]
  const propertyMatches = text.matchAll(/A\s+1\s+([A-Z0-9\s,\/\-\(\)\.]+?)\s+(\d{4}-\d{2}-\d{2})\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/gi);
  for (const match of propertyMatches) {
    assets.push({
      description: match[1].trim(),
      category: 'A' as const,
      cost: parseAmount(match[3]),
      marketValue: parseAmount(match[4]),
      dateAcquired: match[2],
    });
  }
  
  // Extract bank balances
  // Pattern: A [Code] [Bank Name] [Account No] [Type] [Balance]
  // Relaxed pattern to catch more variations
  const bankMatches = text.matchAll(/A\s+\d+\s+([A-Z\s\-\.]+(?:BANK|FINANCE|PLC)[A-Z\s\-\.]*)\s+(\d+)\s+.*?\s+([\d,]+\.?\d*)\s*$/gim);
  for (const match of bankMatches) {
    const balance = parseAmount(match[3]);
    if (balance > 0) {
      assets.push({
        description: `${match[1].trim()} - ${match[2]}`,
        category: 'Bii' as const,
        cost: balance,
        marketValue: balance,
      });
    }
  }
  
  // Extract cash in hand
  const cashMatch = text.match(/(?:iv\.|4\.)\s*Cash in hand.*?(\d+)\s+([\d,]+\.?\d*)/i);
  if (cashMatch) {
    const cashAmount = parseAmount(cashMatch[2]);
    if (cashAmount > 0) {
      assets.push({
        description: 'Cash in Hand',
        category: 'Biv' as const,
        cost: cashAmount,
        marketValue: cashAmount,
      });
    }
  }
  
  // Extract loans given
  const loansGivenMatch = text.match(/(?:v\.|5\.)\s*Loans given.*?(\d+)\s+([\d,]+\.?\d*)/i);
  if (loansGivenMatch) {
    const loanAmount = parseAmount(loansGivenMatch[2]);
    if (loanAmount > 0) {
      assets.push({
        description: 'Loans Given & Amount Receivable',
        category: 'Bv' as const,
        cost: loanAmount,
        marketValue: loanAmount,
      });
    }
  }
  
  // Extract gold, gems, jewelry
  const valuablesMatch = text.match(/(?:vi\.|6\.)\s*Value of gold.*?(\d+)\s+([\d,]+\.?\d*)/i);
  if (valuablesMatch) {
    const valuablesAmount = parseAmount(valuablesMatch[2]);
    if (valuablesAmount > 0) {
      assets.push({
        description: 'Gold, Silver, Gems, Jewellery',
        category: 'Bvi' as const,
        cost: valuablesAmount,
        marketValue: valuablesAmount,
      });
    }
  }
  
  return assets;
}

function extractLiabilities(text: string) {
  const liabilities = [];
  
  // Extract housing loans and other liabilities
  // Look for lines in Liability section (usually starts with L or in a specific table)
  // RAMIS often lists them under "Liabilities" or similar headers
  // We'll look for the pattern: [Description] [Lender] [Date] [Original] [Balance]
  // But often it's just mixed. We'll stick to the "A ..." pattern if it appears there (sometimes liabilities are mixed in older forms)
  // OR look for specific keywords like "LOAN" followed by amounts.
  
  const liabilityMatches = text.matchAll(/(?:LOAN|MORTGAGE|CREDIT CARD)\s+([A-Z\s\-0-9]+?)\s+(\d{4}-\d{2}-\d{2})?\s*([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/gi);
  
  for (const match of liabilityMatches) {
    const description = match[0].trim(); // Full match includes LOAN/MORTGAGE
    const lender = match[1].trim();
    const date = match[2] || new Date().toISOString().split('T')[0];
    const original = parseAmount(match[3]);
    const balance = parseAmount(match[4]);
    
    if (balance > 0) {
      liabilities.push({
        description: description,
        lenderName: lender || 'Unknown Lender',
        originalAmount: original,
        currentBalance: balance,
        dateAcquired: date,
      });
    }
  }
  
  return liabilities;
}

function parseAmount(value?: string): number {
  if (!value) return 0;
  // Remove commas and parse as float
  return parseFloat(value.replace(/,/g, '')) || 0;
}
