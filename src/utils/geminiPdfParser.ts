/**
 * Gemini AI-powered PDF parser for RAMIS tax documents
 * Uses Google's Gemini API to extract structured data from tax PDFs
 */

import { ParsedTaxData } from '@/types/import';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
      * NOTE: Account type may be in Account No field (e.g., "220200180010392 SAVING")

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

JSON SCHEMA (extract all available fields):
{
  "taxYear": "2023",
  "taxpayerInfo": {
    "name": "FULL NAME AS WRITTEN IN DOCUMENT",
    "tin": "TIN number",
    "nic": "NIC from declarant section",
    "email": "email from declarant section",
    "phone": "phone/mobile from declarant section",
    "isResident": true,
    "isSeniorCitizen": false
  },
  "employmentIncome": [
    {
      "employerName": "EMPLOYER NAME",
      "employerTIN": "employer TIN",
      "grossRemuneration": 0,
      "apitDeducted": 0,
      "exemptIncome": 0
    }
  ],
  "investmentIncome": [
    {
      "type": "interest",
      "source": "I-INTEREST",
      "withholdingAgentTIN": "TIN",
      "certificateNo": "certificate number",
      "grossAmount": 0,
      "whtDeducted": 0,
      "dateOfPayment": "date if available"
    }
  ],
  "taxSummary": {
    "totalAssessableIncome": 0,
    "personalRelief": 0,
    "taxableIncome": 0,
    "totalTaxPayable": 0,
    "taxCredits": 0,
    "balanceTaxPayable": 0,
    "refundClaimed": 0
  },
  "assets": [
    {
      "category": "A",
      "type": "Immovable Property",
      "description": "LAND IN address (notes about co-ownership if any)",
      "dateAcquired": "YYYY-MM-DD",
      "cost": 0,
      "marketValue": 0,
      "ownershipNotes": "CO-OWNERS WITH HUSBAND if mentioned"
    },
    {
      "category": "Bii",
      "type": "Bank Account",
      "bankName": "PEOPLES BANK",
      "accountNo": "last 4-6 digits visible",
      "accountType": "SAVING/CURRENT/Fixed Deposit",
      "amountInvested": 0,
      "interest": 0,
      "balance": 0
    },
    {
      "category": "Biv",
      "type": "Cash in Hand",
      "marketValue": 0
    },
    {
      "category": "Bv",
      "type": "Loans Given",
      "marketValue": 0
    },
    {
      "category": "Bvi",
      "type": "Gold/Jewellery",
      "description": "gold, silver, gems, jewellery",
      "marketValue": 0
    }
  ],
  "liabilities": [
    {
      "type": "A",
      "description": "HOUSING LOAN - account_number",
      "lenderName": "extract from description or context",
      "securedBy": "LAND/property type",
      "dateObtained": "YYYY-MM-DD if available",
      "originalAmount": 0,
      "currentBalance": 0,
      "amountRepaid": 0
    }
  ]
}

CRITICAL EXTRACTION RULES:
1. **Tax Year**: "Year of assessment 2023/2024" → extract "2023" (first year)
2. **Name**: Extract EXACTLY as written in "Name of taxpayer" field
3. **TIN**: 9-digit number from "Taxpayer Identification Number (TIN)" field
4. **NIC**: From "National Identity card number of declarant" on last page
5. **Monetary Values**: 
   - Remove "Rs.", commas, and extra spaces
   - Convert "3,094,166.00" → 3094166.00
   - Keep as numeric values
6. **Dates**: 
   - Format "2020-11-11" stays as is
   - If "31.03.2024", convert to "2024-03-31"
7. **Interest Income**:
   - Create separate entry for EACH row in the interest table
   - Extract: source type, TIN, certificate no, amount, WHT deducted
8. **Bank Accounts**:
   - Account type might be in the Account No column (e.g., "220200180010392 SAVING")
   - Extract bank name, account type, balance, interest separately
9. **Property**:
   - Include ownership notes like "(CO-OWNERS WITH HUSBAND)" in description or ownershipNotes
   - Extract full address from "Situation of property"
10. **Cash/Loans/Jewellery**:
    - These appear as single line items with codes (1019, 1020, 1021)
    - Extract the numeric value only
11. **Liabilities**:
    - Description format: "HOUSING LOAN - account_number"
    - Extract loan type (HOUSING, VEHICLE, etc.)
    - Security column shows what secures the loan (LAND, etc.)
12. **Missing Data**: Use empty array [] for sections with no data

IMPORTANT: The RAMIS format shows data in TABLES. Pay attention to column headers and extract each row as a separate item.

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
