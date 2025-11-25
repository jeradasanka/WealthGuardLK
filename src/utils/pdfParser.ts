import { ParsedTaxData } from '@/types/import';

/**
 * Parse PDF buffer and extract tax-related data
 * This is a placeholder that will be enhanced based on actual PDF structure
 */
export async function parseTaxPDF(file: File): Promise<ParsedTaxData> {
  try {
    // For browser environment, we'll use a different approach
    // Instead of pdf-parse (which is Node.js), we'll extract text using PDF.js or manual parsing
    
    const text = await extractTextFromPDF(file);
    
    // Extract tax year from filename or content
    const taxYear = extractTaxYear(text, file.name);
    
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
    
    return parsedData;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file. Please ensure it is a valid RAMIS tax return.');
  }
}

async function extractTextFromPDF(file: File): Promise<string> {
  // For now, we'll use FileReader to get text
  // In production, you might want to use pdf.js library
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      // This is a simplified version - in reality, PDF binary needs proper parsing
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function extractTaxYear(text: string, filename: string): string {
  // Try to extract year from filename first (e.g., "RAMIS 2024.pdf")
  const filenameMatch = filename.match(/20\d{2}/);
  if (filenameMatch) {
    return filenameMatch[0];
  }
  
  // Try to extract from content
  const contentMatch = text.match(/(?:Tax Year|Year of Assessment|Y\/A)\s*[:\-]?\s*(20\d{2}(?:\/\d{2})?)/i);
  if (contentMatch) {
    return contentMatch[1].split('/')[0]; // Get first year if in format 2024/25
  }
  
  // Default to current tax year
  const now = new Date();
  const month = now.getMonth();
  return month < 3 ? (now.getFullYear() - 1).toString() : now.getFullYear().toString();
}

function extractTaxpayerInfo(text: string) {
  const nameMatch = text.match(/(?:Name|Taxpayer Name)\s*[:\-]?\s*([A-Za-z\s\.]+?)(?:\n|TIN)/i);
  const tinMatch = text.match(/(?:TIN|Tax Identification Number)\s*[:\-]?\s*(\d{9,12})/i);
  const nicMatch = text.match(/(?:NIC|National Identity Card)\s*[:\-]?\s*(\d{9}[VvXx]|\d{12})/i);
  
  return {
    name: nameMatch?.[1]?.trim(),
    tin: tinMatch?.[1]?.trim(),
    nic: nicMatch?.[1]?.trim(),
  };
}

function extractEmploymentIncome(text: string) {
  const incomes = [];
  
  // Look for employment income sections (Schedule 1, Cage 103-104)
  const employmentSection = text.match(/(?:Schedule\s*1|Employment Income|Gross Remuneration)(.*?)(?:Schedule\s*2|Business Income|$)/is);
  
  if (employmentSection) {
    const section = employmentSection[1];
    
    // Extract employer details
    const employerMatch = section.match(/(?:Employer Name|Employer)\s*[:\-]?\s*([A-Za-z\s&\.]+?)(?:\n|TIN)/i);
    const tinMatch = section.match(/(?:Employer TIN)\s*[:\-]?\s*(\d{9,12})/i);
    const grossMatch = section.match(/(?:Gross Remuneration|Cage 103)\s*[:\-]?\s*Rs?\.?\s*([\d,]+(?:\.\d{2})?)/i);
    const benefitsMatch = section.match(/(?:Non-Cash Benefits|Cage 104)\s*[:\-]?\s*Rs?\.?\s*([\d,]+(?:\.\d{2})?)/i);
    const apitMatch = section.match(/(?:APIT|Cage 903)\s*[:\-]?\s*Rs?\.?\s*([\d,]+(?:\.\d{2})?)/i);
    
    if (employerMatch || grossMatch) {
      incomes.push({
        employerName: employerMatch?.[1]?.trim() || 'Unknown Employer',
        employerTIN: tinMatch?.[1]?.trim(),
        grossRemuneration: parseAmount(grossMatch?.[1]),
        nonCashBenefits: parseAmount(benefitsMatch?.[1]),
        apitDeducted: parseAmount(apitMatch?.[1]),
        exemptIncome: 0,
      });
    }
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
  
  const investmentSection = text.match(/(?:Schedule\s*3|Investment Income|Interest.*?Dividends.*?Rent)(.*?)(?:Schedule\s*4|Assets|$)/is);
  
  if (investmentSection) {
    const section = investmentSection[1];
    
    const dividendsMatch = section.match(/(?:Dividends|Cage 301)\s*[:\-]?\s*Rs?\.?\s*([\d,]+(?:\.\d{2})?)/i);
    const interestMatch = section.match(/(?:Interest|Cage 302)\s*[:\-]?\s*Rs?\.?\s*([\d,]+(?:\.\d{2})?)/i);
    const rentMatch = section.match(/(?:Rent|Rental Income|Cage 303)\s*[:\-]?\s*Rs?\.?\s*([\d,]+(?:\.\d{2})?)/i);
    
    if (dividendsMatch || interestMatch || rentMatch) {
      incomes.push({
        source: 'Mixed Investments',
        dividends: parseAmount(dividendsMatch?.[1]),
        interest: parseAmount(interestMatch?.[1]),
        rent: parseAmount(rentMatch?.[1]),
      });
    }
  }
  
  return incomes;
}

function extractAssets(text: string) {
  const assets = [];
  
  // Extract immovable property (Cage 701)
  const propertyMatches = text.matchAll(/(?:Cage 701|Immovable Property).*?Description[:\-\s]+([^\n]+).*?Cost[:\-\s]+Rs?\.?\s*([\d,]+(?:\.\d{2})?)/gis);
  for (const match of propertyMatches) {
    assets.push({
      description: match[1].trim(),
      category: '701' as const,
      cost: parseAmount(match[2]),
      marketValue: parseAmount(match[2]), // Default to cost if market value not specified
    });
  }
  
  // Extract vehicles (Cage 711)
  const vehicleMatches = text.matchAll(/(?:Cage 711|Motor Vehicle).*?(?:Description|Reg No)[:\-\s]+([^\n]+).*?Cost[:\-\s]+Rs?\.?\s*([\d,]+(?:\.\d{2})?)/gis);
  for (const match of vehicleMatches) {
    assets.push({
      description: match[1].trim(),
      category: '711' as const,
      cost: parseAmount(match[2]),
      marketValue: parseAmount(match[2]),
    });
  }
  
  // Extract bank/financial assets (Cage 721)
  const financialMatches = text.matchAll(/(?:Cage 721|Bank|Financial Asset).*?(?:Description|Account)[:\-\s]+([^\n]+).*?(?:Balance|Value)[:\-\s]+Rs?\.?\s*([\d,]+(?:\.\d{2})?)/gis);
  for (const match of financialMatches) {
    assets.push({
      description: match[1].trim(),
      category: '721' as const,
      cost: parseAmount(match[2]),
      marketValue: parseAmount(match[2]),
    });
  }
  
  return assets;
}

function extractLiabilities(text: string) {
  const liabilities = [];
  
  const liabilityMatches = text.matchAll(/(?:Cage 781|Liability|Loan).*?(?:Description|Lender)[:\-\s]+([^\n]+).*?(?:Original Amount|Principal)[:\-\s]+Rs?\.?\s*([\d,]+(?:\.\d{2})?).*?(?:Current Balance|Outstanding)[:\-\s]+Rs?\.?\s*([\d,]+(?:\.\d{2})?)/gis);
  
  for (const match of liabilityMatches) {
    liabilities.push({
      description: match[1].trim(),
      lenderName: match[1].split('-')[0].trim() || 'Unknown Lender',
      originalAmount: parseAmount(match[2]),
      currentBalance: parseAmount(match[3]),
    });
  }
  
  return liabilities;
}

function parseAmount(value?: string): number {
  if (!value) return 0;
  // Remove commas and parse as float
  return parseFloat(value.replace(/,/g, '')) || 0;
}
