/**
 * Financial Asset Balance PDF Parser using Gemini AI
 * Extracts balance data from bank statements and other financial documents
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getTaxYearForDate } from '../lib/taxYear';

export interface ParsedFinancialBalance {
  assetId?: string; // Will be linked later
  taxYear: string;
  closingBalance: number;
  interestEarned: number;
  
  // Additional extracted data for context
  accountNumber?: string;
  accountHolderName?: string;
  bankName?: string;
  accountType?: string;
  statementPeriod?: {
    from: string;
    to: string;
  };
  openingBalance?: number;
  totalDeposits?: number;
  totalWithdrawals?: number;
  notes?: string;
}

/**
 * Helper function to convert File to base64
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = (error) => reject(error);
  });
}



/**
 * Parse financial asset balance PDF using Gemini AI
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
export async function parseFinancialBalancePdf(
  file: File,
  apiKey: string,
  model: string = 'gemini-2.0-flash-exp'
): Promise<ParsedFinancialBalance[]> {
  try {
    console.log('Starting Gemini AI financial balance PDF parsing...');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });
    
    // Convert PDF to base64
    const base64Data = await fileToBase64(file);
    
    const prompt = `
You are an expert in analyzing Sri Lankan bank statements and financial documents. Analyze this PDF which contains bank statements, account summaries, or similar financial documents.

**IMPORTANT: This PDF may be a scanned document or a digital PDF. Use OCR to extract text from scanned images if needed.**

**SCANNING INSTRUCTIONS:**
1. If this is a scanned/image-based PDF, carefully read ALL visible text using OCR
2. Look for account numbers, balances, dates, and transaction details
3. Extract numbers carefully, distinguishing between similar-looking digits (0 vs O, 1 vs l, 5 vs S)
4. Pay attention to currency formatting (commas, decimal points)
5. Identify debit vs credit columns correctly
6. If text is unclear, make your best interpretation based on context

**DATA EXTRACTION INSTRUCTIONS:**
Extract financial balance information for each account or financial year period found in the document.

For each balance record, extract:
1. **Statement Period**: Start date and end date (format: YYYY-MM-DD)
2. **Account Information**:
   - Account holder name
   - Account number
   - Bank/Institution name
   - Account type (Savings, Current, Fixed Deposit, etc.)
3. **Balance Information**:
   - Opening balance (balance at start of period)
   - Closing balance (balance at end of period) - **REQUIRED**
   - Total deposits/credits during period
   - Total withdrawals/debits during period
4. **Interest Information**:
   - Interest earned during the period (look for interest credits, interest paid, etc.)
   - Interest rate (if mentioned)

**IMPORTANT TAX YEAR CALCULATION:**
- Sri Lankan tax year runs from April 1 to March 31
- For a statement ending between Jan 1 - Mar 31: tax year = (year - 1)
- For a statement ending between Apr 1 - Dec 31: tax year = year
- Example: Statement ending on 2024-03-31 = tax year "2024" (FY 2024/2025)
- Example: Statement ending on 2024-12-31 = tax year "2024" (FY 2024/2025)

**MULTIPLE PERIODS:**
If the PDF contains multiple statement periods (e.g., monthly statements), create a separate entry for each period that aligns with a tax year end (March 31).

**OUTPUT FORMAT:**
Return ONLY a valid JSON array with NO markdown formatting, NO code blocks, NO backticks. The response must start with [ and end with ].

[
  {
    "taxYear": "2024",
    "closingBalance": 1500000.00,
    "interestEarned": 45000.00,
    "accountNumber": "123456789",
    "accountHolderName": "John Doe",
    "bankName": "Commercial Bank",
    "accountType": "Savings Account",
    "statementPeriod": {
      "from": "2023-04-01",
      "to": "2024-03-31"
    },
    "openingBalance": 1200000.00,
    "totalDeposits": 500000.00,
    "totalWithdrawals": 245000.00,
    "notes": "Annual statement for FY 2024/2025"
  }
]

**VALIDATION:**
- Closing balance must be a positive number or zero
- Interest earned must be >= 0
- Tax year must be a 4-digit year string
- Ensure opening balance + deposits - withdrawals + interest ≈ closing balance (accounting for rounding)

Extract all balance records from the PDF and return them in the JSON format above.
`;

    console.log('Sending request to Gemini AI...');
    const result = await geminiModel.generateContent([
      {
        inlineData: {
          mimeType: file.type,
          data: base64Data,
        },
      },
      { text: prompt },
    ]);

    const response = await result.response;
    const text = response.text();
    console.log('Gemini AI response received:', text);

    // Clean up response - remove markdown code blocks if present
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/g, '');
    }

    // Parse JSON response
    const parsedData: ParsedFinancialBalance[] = JSON.parse(cleanedText);
    
    // Validate and process each balance record
    const processedData = parsedData.map(balance => {
      // Ensure tax year is determined
      if (!balance.taxYear && balance.statementPeriod?.to) {
        balance.taxYear = getTaxYearForDate(balance.statementPeriod.to);
      }
      
      // Ensure required fields
      if (typeof balance.closingBalance !== 'number') {
        balance.closingBalance = 0;
      }
      if (typeof balance.interestEarned !== 'number') {
        balance.interestEarned = 0;
      }
      
      return balance;
    });

    console.log('Successfully parsed financial balance data:', processedData);
    return processedData;
    
  } catch (error) {
    console.error('Error parsing financial balance PDF:', error);
    throw new Error(`Failed to parse financial balance PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
