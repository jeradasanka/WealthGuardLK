/**
 * Liability Payment PDF Parser using Gemini AI
 * Extracts payment data from loan statements, payment receipts, and amortization schedules
 */

import { parseWithGeminiAI } from './pdfParserUtils';
import { getTaxYearForDate } from '../lib/taxYear';

export interface ParsedLiabilityPayment {
  liabilityId?: string; // Will be linked later
  date: string;
  principalPaid: number;
  interestPaid: number;
  totalPaid: number;
  balanceAfterPayment: number;
  taxYear: string;
  
  // Additional extracted data for context
  loanAccountNumber?: string;
  lenderName?: string;
  borrowerName?: string;
  paymentReference?: string;
  paymentMethod?: string;
  notes?: string;
}


/**
 * Parse liability payment PDF using Gemini AI
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
export async function parseLiabilityPaymentPdf(
  file: File,
  apiKey: string,
  model: string = 'gemini-2.0-flash-exp'
): Promise<ParsedLiabilityPayment[]> {
  try {
    console.log('Starting Gemini AI liability payment PDF parsing...');
    
    const prompt = `
You are an expert in analyzing Sri Lankan loan statements, payment receipts, and amortization schedules. Analyze this PDF which contains loan payment information, amortization schedules, or payment receipts.

**IMPORTANT: This PDF may be a scanned document or a digital PDF. Use OCR to extract text from scanned images if needed.**

**SCANNING INSTRUCTIONS:**
1. If this is a scanned/image-based PDF, carefully read ALL visible text using OCR
2. Look for loan account numbers, payment dates, amounts, and balance information
3. Extract numbers carefully, distinguishing between similar-looking digits (0 vs O, 1 vs l, 5 vs S)
4. Pay attention to currency formatting (commas, decimal points)
5. Identify principal vs interest columns correctly
6. Look for running balance or outstanding balance columns
7. If text is unclear, make your best interpretation based on context

**DATA EXTRACTION INSTRUCTIONS:**
Extract loan payment information for each payment found in the document.

For each payment record, extract:
1. **Payment Date**: Date of payment (format: YYYY-MM-DD) - **REQUIRED**
2. **Payment Breakdown**:
   - Principal paid (amount reducing the loan principal) - **REQUIRED**
   - Interest paid (interest component of payment) - **REQUIRED**
   - Total payment amount (principal + interest) - **REQUIRED**
3. **Balance Information**:
   - Outstanding balance after this payment - **REQUIRED**
   - Previous balance (if shown)
4. **Loan Information**:
   - Loan account number
   - Lender name (bank, financial institution)
   - Borrower name
   - Payment reference/receipt number
   - Payment method (cash, cheque, bank transfer, etc.)

**IMPORTANT TAX YEAR CALCULATION:**
- Sri Lankan tax year runs from April 1 to March 31
- For a payment date between Jan 1 - Mar 31: tax year = (year - 1)
- For a payment date between Apr 1 - Dec 31: tax year = year
- Example: Payment on 2024-03-15 = tax year "2024" (FY 2024/2025)
- Example: Payment on 2024-06-15 = tax year "2024" (FY 2024/2025)

**DOCUMENT TYPES:**
The PDF may contain:
- Amortization schedule (multiple payments in a table)
- Individual payment receipts (one payment per page)
- Loan statement showing payment history
- Bank statement showing loan deductions

Extract ALL payments found in the document.

**CALCULATION RULES:**
- If only total payment is shown: Try to identify principal and interest breakdown from context
- If breakdown not available: Assume all payment is principal (set interestPaid = 0)
- Total paid must equal principal paid + interest paid
- Balance after payment = previous balance - principal paid

**OUTPUT FORMAT:**
Return ONLY a valid JSON array with NO markdown formatting, NO code blocks, NO backticks. The response must start with [ and end with ].

[
  {
    "date": "2024-03-15",
    "principalPaid": 50000.00,
    "interestPaid": 15000.00,
    "totalPaid": 65000.00,
    "balanceAfterPayment": 950000.00,
    "taxYear": "2024",
    "loanAccountNumber": "LON123456",
    "lenderName": "Commercial Bank",
    "borrowerName": "John Doe",
    "paymentReference": "PMT-2024-03-001",
    "paymentMethod": "Bank Transfer",
    "notes": "Monthly installment payment"
  }
]

**VALIDATION:**
- Date must be in YYYY-MM-DD format
- Principal paid must be >= 0
- Interest paid must be >= 0
- Total paid must equal principal + interest
- Balance after payment must be >= 0
- Tax year must be a 4-digit year string

Extract all payment records from the PDF and return them in the JSON format above.
`;

    // Parse using shared utility
    const parsedData = await parseWithGeminiAI<ParsedLiabilityPayment[]>(file, apiKey, prompt, model);
    
    // Validate and process each payment record
    const processedData = parsedData.map(payment => {
      // Ensure tax year is determined
      if (!payment.taxYear && payment.date) {
        payment.taxYear = getTaxYearForDate(payment.date);
      }
      
      // Validate total = principal + interest
      const calculatedTotal = payment.principalPaid + payment.interestPaid;
      if (Math.abs(payment.totalPaid - calculatedTotal) > 0.01) {
        // Auto-correct if minor rounding difference
        payment.totalPaid = calculatedTotal;
      }
      
      // Ensure required fields have valid numbers
      if (typeof payment.principalPaid !== 'number' || payment.principalPaid < 0) {
        payment.principalPaid = 0;
      }
      if (typeof payment.interestPaid !== 'number' || payment.interestPaid < 0) {
        payment.interestPaid = 0;
      }
      if (typeof payment.balanceAfterPayment !== 'number' || payment.balanceAfterPayment < 0) {
        payment.balanceAfterPayment = 0;
      }
      
      return payment;
    });

    console.log('Successfully parsed liability payment data:', processedData);
    return processedData;
    
  } catch (error) {
    console.error('Error parsing liability payment PDF:', error);
    throw new Error(`Failed to parse liability payment PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
