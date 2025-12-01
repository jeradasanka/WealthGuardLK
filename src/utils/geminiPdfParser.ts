/**
 * Gemini AI-powered PDF parser for RAMIS tax documents
 * Uses Google's Gemini API to extract structured data from tax PDFs
 */

import { ParsedTaxData } from '@/types/import';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiModelInfo {
  name: string;
  displayName: string;
  description: string;
  supportedGenerationMethods: string[];
}

// Fallback models in case API fetch fails
export const FALLBACK_GEMINI_MODELS = [
  { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Experimental)', description: 'Latest model, fastest' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'Fast and efficient' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'More capable, slower' },
] as const;

/**
 * Fetch available Gemini models from the API
 * Returns models that support generateContent method for PDF parsing
 */
export async function fetchAvailableGeminiModels(apiKey: string): Promise<Array<{ value: string; label: string; description: string }>> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter models that support generateContent and are suitable for PDF parsing
    // Only include full Gemini models (exclude nano, text-embedding, etc.)
    const models = data.models
      .filter((model: any) => {
        const name = model.name.toLowerCase();
        return (
          model.supportedGenerationMethods?.includes('generateContent') &&
          name.includes('gemini') &&
          // Exclude models not suitable for complex PDF parsing
          !name.includes('nano') &&
          !name.includes('embedding') &&
          !name.includes('text-embedding') &&
          !name.includes('aqa')
        );
      })
      .map((model: any) => {
        // Extract model name from "models/gemini-xxx" format
        const modelName = model.name.replace('models/', '');
        
        return {
          value: modelName,
          label: model.displayName || modelName,
          description: model.description || 'Gemini AI model'
        };
      })
      .sort((a: any, b: any) => {
        // Sort by version (2.0 first, then 1.5, then others)
        if (a.value.includes('2.0') && !b.value.includes('2.0')) return -1;
        if (!a.value.includes('2.0') && b.value.includes('2.0')) return 1;
        if (a.value.includes('1.5') && !b.value.includes('1.5')) return -1;
        if (!a.value.includes('1.5') && b.value.includes('1.5')) return 1;
        return a.label.localeCompare(b.label);
      });
    
    console.log(`Fetched ${models.length} available Gemini models from API`);
    return models.length > 0 ? models : [...FALLBACK_GEMINI_MODELS];
    
  } catch (error) {
    console.warn('Failed to fetch Gemini models from API, using fallback list:', error);
    return [...FALLBACK_GEMINI_MODELS];
  }
}

const SYSTEM_PROMPT = `You are an expert Sri Lankan tax document parser specialized in RAMIS (Revenue Administration Management Information System) "Individual income tax - Confirmation" documents.

Your task is to extract ALL structured data from this RAMIS tax return PDF and return it as a valid JSON object.

ACTUAL RAMIS DOCUMENT STRUCTURE:
Page 1:
- Header: "Individual income tax - Confirmation"
- Taxpayer Identification Number (TIN)
- Name of taxpayer (full name in capital letters)
- Year of assessment (format: "2023/2024")
- Resident/Non-resident status
- Primary Employment section with:
  * TIN of the employer
  * Employer/company name
  * Remuneration (Rs.)
  * APIT paid on Employment income (Rs.)
  * Total exempt/Excluded employment income (Rs.)
- Interest Income section (table with multiple rows):
  * S/N, Source/type (I-INTEREST), TIN of Withholding Agent
  * AIT/WHT certificate No., Amount received (Rs.), Date of payment
  * AIT/WHT deducted (Rs.)
- Senior citizen (Yes/No)

Page 2:
- Continuation of Interest Income table if needed
- Total Exempt/Excluded Interest Income
- Installment payment and AIT/WHT paid
- Summary section:
  * Total assessable income (Rs.)
  * Personal relief (Rs.)
  * Taxable income (Rs.)
  * Total tax payable (Rs.)
  * Less: Tax credits (Rs.)
  * Balance tax payable (Rs.)
  * Refund claimed (Rs.)
- Statement of assets & liabilities:
  * Part 1 - Assets as at 31.03.YYYY
  * A. Immovable properties (table):
    - Type, S/N, Situation of property, Date of acquisition, Cost (Rs.), Market value (Rs.)
    - NOTE: Look for "(CO-OWNERS WITH HUSBAND)" or similar ownership notes
  * B. Movable properties:
    - i. Motor vehicles (table)
    - ii. Bank balances including term deposits as at 31.03.YYYY (table):
      * Type, S/N, Name of bank/financial institution, Account No.
      * Amount invested (Rs.), Interest (Rs.), Balance (Rs.)
      * NOTE: Account type may be in Account No field (e.g., "XXXXXXXXXX SAVING")

Page 3:
  * B. Movable properties (continued):
    - iii. Shares/stocks/securities as at 31.03.YYYY
    - iv. Cash in hand as at 31.03.YYYY (single value with code like "1019")
    - v. Loans given & amount receivable as at 31.03.YYYY (single value with code like "1020")
    - vi. Value of gold, silver, gems, jewellery etc. as at 31.03.YYYY (single value with code like "1021")
  * C. Properties held as part of business
  * D. All liabilities (table):
    - Type, S/N, Description of liability, Security on liability
    - Date of commencement, Original amount, Amount as at 31.03.YYYY, Amount repaid during Y/A
    - NOTE: Look for loan types like "HOUSING LOAN - account_number"
- Part 2:
  * A. Any other assets acquired or gifts received during the year
  * B. Disposal of assets (sale/transfer/gift) during the year

Page 4:
- Declarant information (Full name, Telephone, Mobile, Email, NIC, Date)

JSON SCHEMA - MUST match this exact structure:
{
  "taxYear": "2023",
  "taxpayerInfo": {
    "name": "JOHN DOE SAMPLE",
    "tin": "123456789",
    "nic": "199012345678"
  },
  "employmentIncome": [
    {
      "employerName": "ABC COMPANY (PVT) LTD",
      "employerTIN": "123456789",
      "grossRemuneration": 3094166.00,
      "nonCashBenefits": 0,
      "apitDeducted": 279923.00,
      "exemptIncome": 27750.00
    }
  ],
  "investmentIncome": [
    {
      "source": "PEOPLES BANK (or withholdingAgentTIN: 123456789)",
      "interest": 6.60,
      "dividends": 0,
      "rent": 0,
      "wht": 0.33
    }
  ],
  "assets": [
    {
      "description": "LAND IN LOT 123/A, SAMPLE STREET, COLOMBO (CO-OWNERS WITH HUSBAND)",
      "category": "A",
      "cost": 6500000.00,
      "marketValue": 10000000.00,
      "dateAcquired": "2020-11-11"
    },
    {
      "description": "PEOPLES BANK - SAVING - XXXXXXXXXX",
      "category": "Bii",
      "cost": 0,
      "marketValue": 64839.73,
      "dateAcquired": "2023-03-31"
    },
    {
      "description": "Cash in hand",
      "category": "Biv",
      "cost": 100000.00,
      "marketValue": 100000.00,
      "dateAcquired": "2023-03-31"
    },
    {
      "description": "Loans given & amount receivable",
      "category": "Bv",
      "cost": 1000000.00,
      "marketValue": 1000000.00,
      "dateAcquired": "2023-03-31"
    },
    {
      "description": "Gold, silver, gems, jewellery",
      "category": "Bvi",
      "cost": 400000.00,
      "marketValue": 400000.00,
      "dateAcquired": "2023-03-31"
    }
  ],
  "liabilities": [
    {
      "description": "HOUSING LOAN - XXXXXXXXXX (LAND)",
      "lenderName": "Bank",
      "originalAmount": 5000000.00,
      "currentBalance": 4500000.00,
      "dateAcquired": "2024-03-31"
    },
    {
      "description": "HOUSING LOAN - YYYYYYYYYY (LAND)",
      "lenderName": "Bank",
      "originalAmount": 3000000.00,
      "currentBalance": 2500000.00,
      "dateAcquired": "2024-03-31"
    }
  ]
}

CRITICAL MAPPING FOR SOFTWARE COMPATIBILITY:
1. **employmentIncome**: MUST include employerName, employerTIN, grossRemuneration, apitDeducted, exemptIncome
2. **investmentIncome**: MUST have source, and AT LEAST ONE of: interest, dividends, rent. Also wht field.
   - For Interest Income rows: Sum all interest amounts into ONE or MORE entries per bank
   - source = Bank name (from TIN or description) or "Interest Income"
   - interest = sum of all "Amount received"
   - wht = sum of all "AIT/WHT deducted"
3. **assets**: MUST have description, category, cost, marketValue, dateAcquired
   - description should be detailed and include: location, account type, account number, etc.
   - For bank accounts: "BANK_NAME - ACCOUNT_TYPE - ACCOUNT_NO"
   - For property: Include full address and ownership notes in description
   - category: EXACTLY one of "A", "Bi", "Bii", "Biii", "Biv", "Bv", "Bvi", "C"
   - cost and marketValue are REQUIRED (use same value if one is missing)
   - dateAcquired: Use "YYYY-MM-DD" format, or "2023-03-31" if unknown
4. **liabilities**: MUST have description, lenderName, originalAmount, currentBalance, dateAcquired
   - description should include loan type and account number: "HOUSING LOAN - account_number (security)"
   - Extract lenderName from context or use generic "Bank" if not clear

CRITICAL EXTRACTION RULES:
1. **Tax Year**: "Year of assessment 2023/2024" → extract "2023" (first year only)
2. **Taxpayer Info**: Extract name, TIN (from page 1), NIC (from page 4)
3. **Monetary Values**: Remove "Rs.", commas → Convert "3,094,166.00" to 3094166.00 (numeric)
4. **Dates**: Convert to "YYYY-MM-DD" format. "2020-11-11" stays as is. "31.03.2024" → "2024-03-31"

5. **Employment Income** (ONE entry per employer):
   - employerName: Full name from "Employer/company name"
   - employerTIN: From "TIN of the employer"
   - grossRemuneration: From "Remuneration (Rs.)"
   - apitDeducted: From "APIT paid on Employment income (Rs.)"
   - exemptIncome: From "Total exempt/Excluded employment income (Rs.)"
   - nonCashBenefits: 0 if not specified

6. **Investment Income** (Consolidate interest income):
   - Group all interest rows by withholding agent/bank
   - source: Bank name or "Interest Income from [TIN]"
   - interest: SUM of all "Amount received" values
   - wht: SUM of all "AIT/WHT deducted" values  
   - dividends: 0 (unless dividend section exists)
   - rent: 0 (unless rent section exists)

7. **Assets** - Each asset must have description, category, cost, marketValue, dateAcquired:
   
   **A (Immovable Property)**:
   - description: "LAND IN [full address] ([ownership notes if any])"
   - category: "A"
   - cost: From "Cost (Rs.)" column
   - marketValue: From "Market value (Rs.)" column
   - dateAcquired: From "Date of acquisition" (convert to YYYY-MM-DD)
   
   **Bii (Bank Accounts)**:
   - description: "[Bank Name] - [Account Type] - [Account No]"
   - category: "Bii"
   - cost: 0 or "Amount invested"
   - marketValue: From "Balance (Rs.)" column
   - dateAcquired: "2023-03-31" (end of tax year)
   
   **Biv (Cash in Hand)**:
   - description: "Cash in hand"
   - category: "Biv"
   - cost: Value from cash line (code 1019)
   - marketValue: Same as cost
   - dateAcquired: "2023-03-31"
   
   **Bv (Loans Given)**:
   - description: "Loans given & amount receivable"
   - category: "Bv"
   - cost: Value from loans line (code 1020)
   - marketValue: Same as cost
   - dateAcquired: "2023-03-31"
   
   **Bvi (Jewellery)**:
   - description: "Gold, silver, gems, jewellery"
   - category: "Bvi"
   - cost: Value from jewellery line (code 1021)
   - marketValue: Same as cost
   - dateAcquired: "2023-03-31"

8. **Liabilities** - CRITICAL - Each liability must have ALL fields with CORRECT values:
   
   **IMPORTANT**: The liabilities table has these columns in order:
   - Type (A, B, etc.)
   - S/N (row number: 1, 2, 3...)
   - Description of liability (e.g., "HOUSING LOAN - XXXXXXXXXX")
   - Security on liability (e.g., "LAND")
   - Date of commencement (may be missing - use tax year end date)
   - **Original amount of liability (Rs.)** - THIS IS THE KEY COLUMN
   - **Amount of liability, as at 31.03.YYYY** - THIS IS THE CURRENT BALANCE
   - Amount repaid during the Y/A (Rs.) - This is the yearly payment
   
   **EXTRACTION RULES FOR LIABILITIES**:
   - description: "[Description from table] ([Security])"
     Example: "HOUSING LOAN - XXXXXXXXXX (LAND)"
   - lenderName: Use "Bank" or try to extract from context
   - **originalAmount**: MUST be the value from "Original amount of liability (Rs.)" column
     Example: "5,000,000.00" → 5000000.00 (remove commas, convert to number)
   - **currentBalance**: MUST be the value from "Amount of liability, as at 31.03.YYYY" column
     Example: "5,000,000.00" → 5000000.00 (remove commas, convert to number)
   - dateAcquired: Use "Date of commencement" if available, otherwise use "[YYYY]-03-31" where YYYY is tax year + 1
     Example: For tax year 2023/2024, use "2024-03-31"
   
   **COMMON ERRORS TO AVOID**:
   - ❌ Don't use the "Amount repaid" as originalAmount or currentBalance
   - ❌ Don't swap originalAmount and currentBalance
   - ❌ Don't use 0 for missing values - extract the actual numbers from the table
   - ✅ originalAmount should be LARGER than or EQUAL to currentBalance
   - ✅ Both amounts MUST be positive numbers
   
   **Example from table**:
   Table row: HOUSING LOAN - XXXXXXXXXX | LAND | 5,000,000.00 | 4,500,000.00 | 500,000.00
   
   Should extract as:
   - originalAmount: 5000000.00
   - currentBalance: 4500000.00
   - description: "HOUSING LOAN - XXXXXXXXXX (LAND)"

9. **Required Fields**: 
   - taxYear: REQUIRED (string)
   - All arrays: If section is empty, use [] (empty array)
   - All monetary values: MUST be numeric (no strings, no currency symbols)
   - All dates: MUST be "YYYY-MM-DD" format
   - category: MUST be exactly one of: "A", "Bi", "Bii", "Biii", "Biv", "Bv", "Bvi", "C"

10. **Data Consolidation**:
    - Interest Income: If 14 rows for same bank, create ONE investmentIncome entry with total
    - Assets: Create ONE entry per asset (each bank account, each property, etc.)
    - Liabilities: Create ONE entry per liability row (each loan separately)
    - Missing values: Use 0 for numeric fields, "" for strings, date format for dates

11. **CRITICAL - LIABILITY AMOUNTS**:
    - The liability table shows amounts in THIS ORDER: Original Amount, Current Balance, Amount Repaid
    - ALWAYS extract originalAmount from "Original amount of liability (Rs.)" column
    - ALWAYS extract currentBalance from "Amount of liability, as at 31.03.YYYY" column
    - DO NOT use the "Amount repaid" column for originalAmount or currentBalance
    - Verify: originalAmount >= currentBalance (original should be equal or larger)
    - Both values MUST be positive numbers extracted from the PDF table

IMPORTANT: The software expects simple, flat structure. Put ALL details in the description field for assets/liabilities.

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
export async function parseWithGeminiDirect(
  file: File, 
  apiKey: string,
  modelName: string = 'gemini-2.0-flash-exp'
): Promise<ParsedTaxData> {
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
    const model = genAI.getGenerativeModel({ model: modelName });

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
