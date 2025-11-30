/**
 * Gemini AI-powered PDF parser for RAMIS tax documents
 * Uses Google's Gemini API to extract structured data from tax PDFs
 */

import { ParsedTaxData } from '@/types/import';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are an expert Sri Lankan tax document parser. You will receive the text content of a RAMIS (Revenue Administration Management Information System) tax return PDF.

Your task is to extract structured data from this document and return it as a JSON object with the following schema:

{
  "taxYear": "2024",  // The tax year (e.g., "2024" for 2024/2025)
  "taxpayerInfo": {
    "name": "John Doe",
    "tin": "123456789V",
    "nic": "123456789V",
    "address": "123 Main St, Colombo"
  },
  "employmentIncome": [
    {
      "employerName": "ABC Company",
      "employerTIN": "987654321",
      "grossRemuneration": 1200000,
      "nonCashBenefits": 50000,
      "apitDeducted": 120000,
      "exemptIncome": 0
    }
  ],
  "businessIncome": [
    {
      "businessName": "My Business",
      "businessRegNo": "PV12345",
      "turnover": 5000000,
      "grossProfit": 2000000,
      "netProfit": 1500000,
      "expenses": 500000
    }
  ],
  "investmentIncome": [
    {
      "type": "interest",  // or "dividend" or "rent"
      "source": "Bank of Ceylon",
      "grossAmount": 100000,
      "whtDeducted": 5000
    }
  ],
  "assets": [
    {
      "category": "A",  // A=Property, Bi=Vehicles, Bii=Bank, Biii=Shares, Biv=Cash, Bv=Loans, Bvi=Jewellery, C=Business
      "description": "House at Colombo",
      "cost": 5000000,
      "marketValue": 6000000,
      "dateAcquired": "2020-01-15"
    }
  ],
  "liabilities": [
    {
      "lenderName": "Commercial Bank",
      "originalAmount": 2000000,
      "currentBalance": 1500000,
      "dateAcquired": "2020-01-15",
      "interestRate": 12.5,
      "purpose": "Home Loan"
    }
  ]
}

IMPORTANT INSTRUCTIONS:
1. Extract ALL data accurately from the document
2. Use proper Sri Lankan tax year format (e.g., "2024" for April 2024 - March 2025)
3. Asset categories: A (Immovable Property), Bi (Motor Vehicles), Bii (Bank Accounts), Biii (Shares), Biv (Cash), Bv (Loans Given), Bvi (Jewellery/Gold/Gems), C (Business Assets)
4. All monetary amounts should be in LKR (numeric values only, no currency symbols)
5. Dates should be in YYYY-MM-DD format
6. If a field is not found in the document, omit it or use null
7. Return ONLY the JSON object, no additional text or explanation
8. Ensure the JSON is valid and properly formatted`;

/**
 * Parse PDF using Gemini AI
 */
export async function parseWithGemini(pdfText: string, apiKey: string): Promise<ParsedTaxData> {
  try {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Gemini API key is required. Please configure it in Settings.');
    }

    console.log('Parsing PDF with Gemini AI...');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `${SYSTEM_PROMPT}\n\n=== RAMIS TAX DOCUMENT TEXT ===\n\n${pdfText}\n\n=== END OF DOCUMENT ===\n\nPlease extract and return the structured JSON data:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('Gemini response:', text);

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\s*/g, '').replace(/```\s*$/g, '');
    }

    const parsedData: ParsedTaxData = JSON.parse(jsonText);

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
 * Convert PDF file to base64 for direct PDF upload to Gemini
 * (Alternative approach - can handle PDFs directly without text extraction)
 */
export async function parseWithGeminiDirect(file: File, apiKey: string): Promise<ParsedTaxData> {
  try {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Gemini API key is required. Please configure it in Settings.');
    }

    console.log('Parsing PDF directly with Gemini AI...');
    
    // Convert file to base64
    const base64Data = await fileToBase64(file);
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: file.type || 'application/pdf',
      },
    };

    const prompt = `${SYSTEM_PROMPT}\n\nPlease analyze this RAMIS tax return PDF and extract the structured data:`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    console.log('Gemini direct response:', text);

    // Extract JSON from response
    let jsonText = text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\s*/g, '').replace(/```\s*$/g, '');
    }

    const parsedData: ParsedTaxData = JSON.parse(jsonText);

    console.log('Successfully parsed PDF directly with Gemini:', parsedData);
    
    return parsedData;
  } catch (error) {
    console.error('Error parsing PDF directly with Gemini:', error);
    if (error instanceof Error) {
      throw new Error(`Gemini AI direct parsing failed: ${error.message}`);
    }
    throw new Error('Failed to parse PDF directly with Gemini AI');
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
