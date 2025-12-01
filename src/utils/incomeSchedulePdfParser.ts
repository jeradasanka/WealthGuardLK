/**
 * Income Schedule PDF Parser using Gemini AI
 * Extracts income data from T10 and other income schedule forms
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ParsedIncomeScheduleData {
  schedule: '1' | '2' | '3'; // Schedule 1: Employment, 2: Business, 3: Investment
  taxYear: string;
  
  // Schedule 1 - Employment Income
  employmentDetails?: {
    employerName: string;
    employerTIN: string;
    employerAddress?: string;
    grossRemuneration: number;
    allowances?: number;
    bonuses?: number;
    nonCashBenefits?: number;
    totalGross: number;
    apitDeducted: number;
    exemptIncome?: number;
    netTaxableIncome: number;
  };
  
  // Schedule 2 - Business Income
  businessDetails?: {
    businessName: string;
    businessTIN?: string;
    businessAddress?: string;
    natureOfBusiness: string;
    grossRevenue: number;
    directExpenses?: number;
    operatingExpenses?: number;
    depreciation?: number;
    totalExpenses: number;
    netProfit: number;
    adjustments?: number;
    taxableProfit: number;
  };
  
  // Schedule 3 - Investment Income
  investmentDetails?: {
    source: string;
    sourceType: 'interest' | 'dividend' | 'rent' | 'other';
    payerName: string;
    payerTIN?: string;
    grossAmount: number;
    whtDeducted?: number;
    netAmount: number;
    exemptPortion?: number;
    taxableAmount: number;
  };
}

/**
 * Parse income schedule PDF using Gemini AI
 * 
 * **SCANNED PDF SUPPORT:**
 * This parser works with both digital and scanned PDFs.
 * Gemini AI has built-in OCR capabilities to extract text from scanned documents.
 * 
 * Tips for best results with scanned PDFs:
 * - Use high-quality scans (300 DPI or higher recommended)
 * - Ensure the document is properly aligned and not skewed
 * - Make sure the text is clearly visible and not too faded
 * - Use gemini-2.0-flash-exp or gemini-1.5-pro for best OCR results
 */
export async function parseIncomeSchedulePdf(
  file: File,
  apiKey: string,
  model: string = 'gemini-2.0-flash-exp'
): Promise<ParsedIncomeScheduleData[]> {
  try {
    console.log('Starting Gemini AI income schedule PDF parsing...');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });
    
    // Convert PDF to base64
    const base64Data = await fileToBase64(file);
    
    const prompt = `
You are an expert in Sri Lankan tax forms and income schedules. Analyze this PDF which contains income schedule forms (T10 or similar) from the Sri Lankan Inland Revenue Department.

**IMPORTANT: This PDF may be a scanned document or a digital PDF. Use OCR to extract text from scanned images if needed.**

**SCANNING INSTRUCTIONS:**
1. If this is a scanned/image-based PDF, carefully read ALL visible text using OCR
2. Look for handwritten or typed entries in form fields
3. Extract numbers carefully, distinguishing between similar-looking digits (0 vs O, 1 vs l, 5 vs S)
4. Pay attention to currency formatting (commas, decimal points)
5. If text is unclear, make your best interpretation based on context

**DATA EXTRACTION INSTRUCTIONS:**
1. Extract ALL income entries from the PDF
2. Identify the schedule type for each entry (Schedule 1: Employment, Schedule 2: Business, Schedule 3: Investment)
3. Extract the tax year (format: "YYYY" e.g., "2024" for tax year 2024/2025)
4. For each income entry, extract all available financial details

**SCHEDULE 1 - EMPLOYMENT INCOME (Cage 901/902/903):**
Extract these fields when available:
- employerName: Name of employer/company
- employerTIN: Tax Identification Number of employer
- employerAddress: Full address of employer
- grossRemuneration: Total salary/wages before deductions
- allowances: Any allowances (transport, housing, etc.)
- bonuses: Bonuses, commissions, overtime
- nonCashBenefits: Value of benefits in kind
- totalGross: Total gross income (sum of all above)
- apitDeducted: APIT (Advance Personal Income Tax) deducted (Cage 903)
- exemptIncome: Any exempt/excluded income
- netTaxableIncome: Taxable employment income

**SCHEDULE 2 - BUSINESS INCOME (Cage 201/202/203):**
Extract these fields when available:
- businessName: Name of business/trade
- businessTIN: TIN of the business (if applicable)
- businessAddress: Business location
- natureOfBusiness: Type of business activity
- grossRevenue: Total business revenue/turnover
- directExpenses: Cost of goods sold, direct labor
- operatingExpenses: Rent, utilities, salaries, etc.
- depreciation: Depreciation of assets
- totalExpenses: Sum of all expenses
- netProfit: Gross revenue minus total expenses
- adjustments: Any tax adjustments
- taxableProfit: Final taxable business profit

**SCHEDULE 3 - INVESTMENT INCOME (Cage 301/302/303/308):**
Extract these fields when available:
- source: Description of investment source
- sourceType: Type of investment ("interest", "dividend", "rent", "other")
- payerName: Name of institution/person paying income
- payerTIN: TIN of payer
- grossAmount: Gross investment income
- whtDeducted: Withholding tax deducted (Cage 908)
- netAmount: Net amount received
- exemptPortion: Any exempt portion
- taxableAmount: Final taxable investment income

**TAX YEAR EXTRACTION:**
- Sri Lankan tax year runs April 1 to March 31
- If form shows dates: Apr-Dec → use that year; Jan-Mar → use previous year
- Format as "YYYY" (e.g., "2024" for FY 2024/2025)

**OUTPUT FORMAT:**
Return ONLY a valid JSON array (no markdown, no explanatory text):

[
  {
    "schedule": "1",
    "taxYear": "2024",
    "employmentDetails": {
      "employerName": "ABC COMPANY (PVT) LTD",
      "employerTIN": "123456789",
      "employerAddress": "123 Main St, Colombo",
      "grossRemuneration": 3000000.00,
      "allowances": 50000.00,
      "bonuses": 100000.00,
      "nonCashBenefits": 0,
      "totalGross": 3150000.00,
      "apitDeducted": 250000.00,
      "exemptIncome": 0,
      "netTaxableIncome": 3150000.00
    }
  },
  {
    "schedule": "3",
    "taxYear": "2024",
    "investmentDetails": {
      "source": "Bank ABC - Savings Account Interest",
      "sourceType": "interest",
      "payerName": "Bank ABC",
      "payerTIN": "987654321",
      "grossAmount": 50000.00,
      "whtDeducted": 2500.00,
      "netAmount": 47500.00,
      "exemptPortion": 0,
      "taxableAmount": 50000.00
    }
  }
]

**CRITICAL RULES:**
- Extract ALL income entries (there may be multiple)
- Use 0 for missing numeric values
- Use undefined for missing optional text fields
- Ensure numeric values are actual numbers, not strings
- Calculate totals if not explicitly stated
- If schedule type is unclear, make best judgment based on income nature

Now analyze this PDF and extract all income schedule data:
`;

    const result = await geminiModel.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data,
        },
      },
      { text: prompt },
    ]);

    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini AI response:', text);
    
    // Parse JSON response
    const cleanedText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsedData = JSON.parse(cleanedText);
    
    console.log('Parsed income schedule data:', parsedData);
    
    return Array.isArray(parsedData) ? parsedData : [parsedData];
  } catch (error) {
    console.error('Error parsing income schedule PDF:', error);
    throw new Error(
      error instanceof Error 
        ? `Failed to parse income schedule: ${error.message}`
        : 'Failed to parse income schedule PDF'
    );
  }
}

/**
 * Convert file to base64
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Determine tax year from date
 * Sri Lankan tax year: April 1 to March 31
 */
export function determineTaxYearFromDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  
  // If Jan-Mar, tax year is previous calendar year
  // If Apr-Dec, tax year is current calendar year
  return month <= 3 ? (year - 1).toString() : year.toString();
}
