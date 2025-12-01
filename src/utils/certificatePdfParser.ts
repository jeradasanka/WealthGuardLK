/**
 * Certificate PDF Parser using Gemini AI
 * Extracts AIT/WHT certificate data from PDF documents
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AITWHTCertificate } from '@/types';

export interface ParsedCertificateData {
  certificateNo: string;
  issueDate: string;
  type: 'employment' | 'interest' | 'dividend' | 'rent' | 'other';
  payerName: string;
  payerTIN: string;
  payeeName?: string; // Employee/Recipient name
  payeeTIN?: string; // Employee/Recipient TIN
  grossAmount: number;
  taxDeducted: number;
  netAmount: number;
  description?: string;
  taxYear?: string; // Derived from issue date or document
  period?: string; // e.g., "January 2024" or "Q1 2024"
}

/**
 * Convert PDF file to base64 string for Gemini API
 */
async function pdfToBase64(file: File): Promise<string> {
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

/**
 * Parse WHT/AIT certificate PDF using Gemini AI
 */
export async function parseCertificatePdf(
  file: File,
  apiKey: string,
  modelName: string = 'gemini-2.0-flash-exp'
): Promise<ParsedCertificateData[]> {
  try {
    const base64Pdf = await pdfToBase64(file);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `You are a tax document parser for Sri Lankan WHT (Withholding Tax) and APIT (Advanced Personal Income Tax) certificates.

Extract ALL certificate data from this PDF document and return it as a JSON array. The PDF may contain one or multiple certificates.

**Certificate Types:**
1. **Employment (APIT)**: Certificates showing APIT deducted from employment income (Cage 903)
2. **Interest (WHT)**: Certificates showing WHT deducted from interest income (Cage 908)
3. **Dividend (WHT)**: Certificates showing WHT deducted from dividend income (Cage 908)
4. **Rent (WHT)**: Certificates showing WHT deducted from rental income (Cage 908)
5. **Other (WHT)**: Other withholding tax certificates

**Extraction Rules:**

1. **Certificate Number**: Extract the unique certificate number/reference number
2. **Issue Date**: Extract the date when the certificate was issued (format: YYYY-MM-DD)
3. **Certificate Type**: Determine the type based on the income category:
   - "employment" for APIT certificates / employment income
   - "interest" for bank interest / fixed deposit certificates
   - "dividend" for dividend income certificates
   - "rent" for rental income certificates
   - "other" for any other WHT certificates

4. **Payer Information** (Employer/Bank/Tenant/Company):
   - Payer Name: Full name of the organization making the payment
   - Payer TIN: Tax Identification Number of the payer

5. **Payee Information** (Employee/Account Holder/Landlord/Investor):
   - Payee Name: Name of the person receiving the income
   - Payee TIN: Tax Identification Number of the recipient

6. **Financial Details**:
   - Gross Amount: Total amount BEFORE tax deduction
   - Tax Deducted: Amount of tax withheld (APIT or WHT)
   - Net Amount: Amount paid AFTER tax deduction (Gross - Tax)
   - Auto-calculate Net Amount if not explicitly stated: Net = Gross - Tax

7. **Period Information**:
   - Tax Year: Extract or derive the tax year (format: "YYYY/YYYY", e.g., "2024/2025")
   - Period: Specific period covered (e.g., "January 2024", "Q1 2024", "Full Year 2024")

8. **Description**: Brief description of the income source (e.g., "Salary - ABC Company", "FD Interest - Bank XYZ", "Rent - Property Address")

**Output Format:**
Return ONLY a valid JSON array (no markdown formatting, no explanatory text):

[
  {
    "certificateNo": "string",
    "issueDate": "YYYY-MM-DD",
    "type": "employment|interest|dividend|rent|other",
    "payerName": "string",
    "payerTIN": "string",
    "payeeName": "string",
    "payeeTIN": "string",
    "grossAmount": number,
    "taxDeducted": number,
    "netAmount": number,
    "description": "string",
    "taxYear": "YYYY/YYYY",
    "period": "string"
  }
]

**Important:**
- Extract ALL certificates if multiple are present
- Use null for missing optional fields
- Ensure all amounts are numeric (no currency symbols)
- Validate that netAmount = grossAmount - taxDeducted
- If tax year cannot be determined, use null
- Be precise with TIN numbers (usually 9-12 digits for Sri Lanka)

Analyze the PDF and extract the certificate data:`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Pdf,
        },
      },
      { text: prompt },
    ]);

    const response = await result.response;
    const text = response.text();

    // Clean up response - remove markdown formatting if present
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const parsedData = JSON.parse(cleanedText) as ParsedCertificateData[];

    // Validate and clean data
    return parsedData.map(cert => ({
      ...cert,
      netAmount: cert.netAmount || (cert.grossAmount - cert.taxDeducted),
      description: cert.description || `${cert.type} income from ${cert.payerName}`,
    }));

  } catch (error) {
    console.error('Error parsing certificate PDF:', error);
    throw new Error(
      error instanceof Error
        ? `Failed to parse certificate PDF: ${error.message}`
        : 'Failed to parse certificate PDF'
    );
  }
}

/**
 * Determine tax year from issue date
 * Sri Lankan tax year: April 1 to March 31
 */
export function determineTaxYearFromDate(dateString: string): string {
  const date = new Date(dateString);
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();

  if (month >= 4) {
    // April to December: current year / next year
    return `${year}/${year + 1}`;
  } else {
    // January to March: previous year / current year
    return `${year - 1}/${year}`;
  }
}
