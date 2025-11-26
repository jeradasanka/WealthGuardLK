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
  
  // Extract interest income total
  const interestMatches = text.matchAll(/I-INTEREST\s+\d+\s+\d+\s+([\d,]+\.?\d*)/gi);
  let totalInterest = 0;
  for (const match of interestMatches) {
    totalInterest += parseAmount(match[1]);
  }
  
  if (totalInterest > 0) {
    incomes.push({
      source: 'Bank Interest',
      dividends: 0,
      interest: totalInterest,
      rent: 0,
    });
  }
  
  return incomes;
}

function extractAssets(text: string) {
  const assets = [];
  
  // Extract immovable property (land/house)
  const propertyMatch = text.match(/A\s+1\s+([A-Z0-9\s,\/\-\(\)]+?)\s+(\d{4}-\d{2}-\d{2})\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/);
  if (propertyMatch) {
    assets.push({
      description: propertyMatch[1].trim(),
      category: 'A' as const,
      cost: parseAmount(propertyMatch[3]),
      marketValue: parseAmount(propertyMatch[4]),
      dateAcquired: propertyMatch[2],
    });
  }
  
  // Extract bank balances
  const bankMatches = text.matchAll(/A\s+\d+\s+([A-Z\s]+BANK[A-Z\s]*)\s+(\d+)\s+[A-Z\s]+\s+[\d,]+\.?\d*\s+[\d,]+\.?\d*\s+([\d,]+\.?\d*)/gi);
  for (const match of bankMatches) {
    const balance = parseAmount(match[3]);
    if (balance > 0) {
      assets.push({
        description: `${match[1].trim()} - Account ${match[2]}`,
        category: 'Bii' as const,
        cost: balance,
        marketValue: balance,
      });
    }
  }
  
  // Extract cash in hand
  const cashMatch = text.match(/iv\. Cash in hand.*?(\d+)\s+([\d,]+\.?\d*)/i);
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
  const loansGivenMatch = text.match(/v\. Loans given.*?(\d+)\s+([\d,]+\.?\d*)/i);
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
  const valuablesMatch = text.match(/vi\. Value of gold.*?(\d+)\s+([\d,]+\.?\d*)/i);
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
  const liabilityMatches = text.matchAll(/A\s+\d+\s+([A-Z\s\-0-9]+?)\s+[A-Z]+\s+(\d{4}-\d{2}-\d{2})?\s*([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/g);
  
  for (const match of liabilityMatches) {
    const description = match[1].trim();
    // Only process if it looks like a loan/liability
    if (description.includes('LOAN') || description.includes('HOUSING')) {
      liabilities.push({
        description: description,
        lenderName: description.split('-')[0].trim() || 'Unknown Lender',
        originalAmount: parseAmount(match[3]),
        currentBalance: parseAmount(match[4]),
        dateAcquired: match[2] || new Date().toISOString().split('T')[0],
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
