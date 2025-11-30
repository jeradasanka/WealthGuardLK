/**
 * Gemini AI-powered PDF parser for RAMIS tax documents
 * Uses Google's Gemini API to extract structured data from tax PDFs
 */

import { ParsedTaxData } from '@/types/import';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are an expert Sri Lankan tax document parser specialized in RAMIS (Revenue Administration Management Information System) tax return documents.

Your task is to extract ALL structured data from this RAMIS tax return PDF and return it as a valid JSON object.

DOCUMENT STRUCTURE TO LOOK FOR:
- Header: Tax year (Y/A format like "Y/A 2024/2025"), Taxpayer name, TIN/NIC
- Part I: Income from Employment (Section A, B, C with employer details, salary, APIT)
- Part II: Income from Business/Profession (Section D, E with turnover, profit)
- Part III: Investment Income (Section F - Interest, G - Dividends, H - Rent)
- Part IV: Other Income (Section I, J, K)
- Part V: Statement of Assets and Liabilities
  * Section A: Immovable Property (land, buildings, apartments)
  * Section Bi: Motor Vehicles (make, model, registration, engine capacity)
  * Section Bii: Bank Accounts/Deposits (bank name, account type, balance)
  * Section Biii: Shares/Securities (company name, quantity, market value)
  * Section Biv: Cash in Hand
  * Section Bv: Loans Given (borrower details, amount, date)
  * Section Bvi: Jewellery, Gold, Gems (type, weight, value)
  * Section C: Business Assets (machinery, inventory, etc.)
  * Section D: Liabilities (loans, mortgages with lender, amount, date, interest rate)

JSON SCHEMA (extract all available fields):

{
  "taxYear": "2024",
  "taxpayerInfo": {
    "name": "Full Name from RAMIS",
    "tin": "TIN number (9 digits + V or 12 digits)",
    "nic": "NIC if different from TIN",
    "address": "Complete address",
    "contactNumber": "Phone number if available",
    "email": "Email if available"
  },
  "employmentIncome": [
    {
      "employerName": "Company/Organization Name",
      "employerTIN": "Employer TIN",
      "employerAddress": "Employer address if available",
      "grossRemuneration": 0,
      "nonCashBenefits": 0,
      "totalIncome": 0,
      "exemptIncome": 0,
      "taxableIncome": 0,
      "apitDeducted": 0,
      "periodFrom": "YYYY-MM-DD",
      "periodTo": "YYYY-MM-DD"
    }
  ],
  "businessIncome": [
    {
      "businessName": "Business/Professional name",
      "businessRegNo": "BR/PV number",
      "businessAddress": "Address",
      "turnover": 0,
      "grossProfit": 0,
      "expenses": 0,
      "netProfit": 0,
      "taxableProfit": 0
    }
  ],
  "investmentIncome": [
    {
      "type": "interest|dividend|rent",
      "source": "Bank/Company/Property name",
      "sourceAddress": "Address if available",
      "grossAmount": 0,
      "whtDeducted": 0,
      "netAmount": 0
    }
  ],
  "assets": [
    {
      "category": "A|Bi|Bii|Biii|Biv|Bv|Bvi|C",
      "description": "Detailed description from RAMIS",
      "location": "Location/Address for property/vehicle",
      "registrationNo": "For vehicles - registration number",
      "make": "For vehicles - manufacturer",
      "model": "For vehicles - model",
      "engineCapacity": "For vehicles - CC",
      "bankName": "For bank accounts",
      "accountNo": "Account number (last 4 digits)",
      "accountType": "Savings/Current/Fixed Deposit",
      "companyName": "For shares/securities",
      "quantity": "Number of shares",
      "weight": "For jewellery - grams/carats",
      "cost": 0,
      "marketValue": 0,
      "dateAcquired": "YYYY-MM-DD",
      "ownershipType": "Individual|Joint|Company",
      "jointOwnerName": "If joint ownership"
    }
  ],
  "liabilities": [
    {
      "lenderName": "Bank/Institution name",
      "lenderAddress": "Address if available",
      "loanType": "Housing|Vehicle|Personal|Business",
      "originalAmount": 0,
      "currentBalance": 0,
      "dateObtained": "YYYY-MM-DD",
      "interestRate": 0,
      "purpose": "Purpose of loan",
      "securedBy": "Collateral if mentioned"
    }
  ],
  "totalIncome": 0,
  "totalTax": 0,
  "taxPaid": 0,
  "balanceTax": 0
}

CRITICAL EXTRACTION RULES:
1. **Tax Year**: Look for "Y/A" or "Year of Assessment" (e.g., "Y/A 2024/2025" → extract "2024")
2. **Monetary Values**: Extract numbers only, remove "Rs.", "LKR", commas. Convert to numeric.
3. **Dates**: Convert to YYYY-MM-DD format. If only year available, use YYYY-01-01
4. **Asset Categories**: 
   - A = Immovable Property (Land, Buildings, Apartments, House)
   - Bi = Motor Vehicles (Car, Van, Motorcycle)
   - Bii = Bank Accounts, Fixed Deposits, Savings
   - Biii = Shares, Debentures, Unit Trusts, Securities
   - Biv = Cash in Hand
   - Bv = Loans Given to Others
   - Bvi = Jewellery, Gold, Gems, Precious Metals
   - C = Business Assets, Machinery, Equipment
5. **Vehicle Details**: Extract Make, Model, Registration No (XX-YYYY or XXX-YYYY format), Engine Capacity (CC)
6. **Bank Accounts**: Extract Bank Name, Account Type, Balance (as of end of tax year)
7. **Property**: Extract address/location, extent (if land), cost, current market value
8. **Liabilities**: Extract lender, loan type, original amount, current balance, interest rate, date obtained
9. **Missing Data**: If a section is empty or field not found, use empty array [] or omit the field
10. **Multiple Entries**: If multiple employers/businesses/assets, create separate array items for each

Return ONLY the valid JSON object. No explanations, no markdown formatting, just the raw JSON.`;

/**
 * Extract and parse JSON from Gemini API response
 * Handles various response formats including markdown code blocks
 */
function extractJsonFromResponse(text: string): ParsedTaxData {
  let jsonText = text.trim();
  
  // Remove markdown code blocks if present
  if (jsonText.includes('```json')) {
    const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      jsonText = match[1].trim();
    } else {
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    }
  } else if (jsonText.includes('```')) {
    const match = jsonText.match(/```\s*([\s\S]*?)\s*```/);
    if (match) {
      jsonText = match[1].trim();
    } else {
      jsonText = jsonText.replace(/```\s*/g, '').replace(/```\s*$/g, '');
    }
  }
  
  // Try to find JSON object if response has extra text
  if (!jsonText.startsWith('{')) {
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
  }
  
  // Remove any trailing text after the JSON object
  const openBraces = jsonText.split('{').length - 1;
  const closeBraces = jsonText.split('}').length - 1;
  if (openBraces === closeBraces && closeBraces > 0) {
    const lastBraceIndex = jsonText.lastIndexOf('}');
    jsonText = jsonText.substring(0, lastBraceIndex + 1);
  }
  
  try {
    const parsed = JSON.parse(jsonText);
    return parsed as ParsedTaxData;
  } catch (error) {
    console.error('Failed to parse JSON:', jsonText);
    throw new Error(`Invalid JSON response from Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse PDF using Gemini AI
 */
export async function parseWithGemini(pdfText: string, apiKey: string): Promise<ParsedTaxData> {
  try {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Gemini API key is required. Please configure it in Settings.');
    }

    console.log('Parsing PDF text with Gemini AI...');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `${SYSTEM_PROMPT}\n\n=== RAMIS TAX DOCUMENT TEXT ===\n\n${pdfText}\n\n=== END OF DOCUMENT ===\n\nPlease extract and return the structured JSON data:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('Gemini response:', text);

    // Extract JSON from response - handle various formats
    const parsedData = extractJsonFromResponse(text);

    console.log('Successfully parsed data with Gemini:', parsedData);
    
    return parsedData;
  } catch (error) {
    console.error('Error parsing with Gemini:', error);
    if (error instanceof Error) {
      throw new Error(`Gemini AI parsing failed: ${error.message}`);
    }
    throw new Error('Failed to parse PDF with Gemini AI');
  }
}

/**
 * Parse PDF by uploading directly to Gemini (using inline data)
 * This sends the actual PDF file to Gemini for analysis
 */
export async function parseWithGeminiDirect(file: File, apiKey: string): Promise<ParsedTaxData> {
  try {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Gemini API key is required. Please configure it in Settings.');
    }

    console.log('Uploading PDF to Gemini AI for parsing...');
    console.log(`File size: ${(file.size / 1024).toFixed(2)} KB`);
    
    // Convert file to base64 for inline upload
    // Note: This is the standard way to send files to Gemini in browser environment
    // The file content is NOT modified, just encoded for transmission
    const base64Data = await fileToBase64(file);
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: file.type || 'application/pdf',
      },
    };

    const prompt = `${SYSTEM_PROMPT}\n\nPlease analyze this RAMIS tax return PDF and extract the structured data:`;

    console.log('Sending PDF to Gemini for analysis...');
    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const text = response.text();

    console.log('Gemini analysis complete');

    // Extract JSON from response - handle various formats
    const parsedData = extractJsonFromResponse(text);

    console.log('Successfully parsed PDF with Gemini');
    
    return parsedData;
  } catch (error) {
    console.error('Error parsing PDF with Gemini:', error);
    if (error instanceof Error) {
      throw new Error(`Gemini AI parsing failed: ${error.message}`);
    }
    throw new Error('Failed to parse PDF with Gemini AI');
  }
}

/**
 * Convert File to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
