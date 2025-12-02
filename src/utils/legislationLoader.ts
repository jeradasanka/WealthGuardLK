/**
 * Tax Legislation Loader
 * Loads and parses PDF files from public/tax-legislation folder
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { fileToBase64 } from './pdfParserUtils';

export interface LegislationDocument {
  name: string;
  path: string;
  category: 'acts' | 'amendments' | 'circulars';
  year?: string;
}

// Registry of available legislation PDFs
export const AVAILABLE_LEGISLATION: LegislationDocument[] = [
  {
    name: 'Inland Revenue Act No. 24 of 2017',
    path: '/tax-legislation/acts/inland-revenue-act-2017.pdf',
    category: 'acts'
  },
  // Add more documents as they are added to public/tax-legislation
];

/**
 * Load and parse a legislation PDF using Gemini AI
 */
export async function loadLegislationPDF(
  pdfPath: string,
  apiKey: string,
  model: string = 'gemini-2.0-flash-exp'
): Promise<string> {
  try {
    console.log('📥 Fetching PDF from:', pdfPath);
    
    // Fetch the PDF from public folder
    const response = await fetch(pdfPath);
    console.log('📡 Fetch response status:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`Failed to load PDF: ${pdfPath} (Status: ${response.status})`);
    }
    
    const blob = await response.blob();
    console.log('📦 PDF blob size:', blob.size, 'bytes');
    
    const file = new File([blob], pdfPath.split('/').pop() || 'document.pdf', {
      type: 'application/pdf'
    });

    console.log('🔄 Converting PDF to base64...');
    // Convert to base64
    const base64Data = await fileToBase64(file);
    console.log('✅ Base64 conversion complete, length:', base64Data.length);

    console.log('🤖 Sending to Gemini AI for text extraction with model:', model);
    // Use Gemini AI to extract text
    const genAI = new GoogleGenerativeAI(apiKey);
    const aiModel = genAI.getGenerativeModel({ model });

    const prompt = `Extract all text content from this tax legislation PDF. 
Preserve the structure including:
- Section numbers
- Headings and subheadings
- Article/clause numbers
- Tables and schedules
- Definitions

Format the output as structured text with clear hierarchy.`;

    const result = await aiModel.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data
        }
      }
    ]);

    const extractedText = result.response.text();
    console.log('✅ Gemini extraction complete, text length:', extractedText.length);
    return extractedText;
  } catch (error) {
    console.error('❌ Error loading legislation PDF:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Search for relevant legislation sections based on a query
 */
export async function searchLegislation(
  query: string,
  legislationText: string,
  apiKey: string,
  model: string = 'gemini-2.0-flash-exp'
): Promise<string> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const aiModel = genAI.getGenerativeModel({ model });

    const prompt = `Based on this tax legislation document, find and extract the most relevant sections for the following query:

Query: "${query}"

Tax Legislation:
${legislationText.slice(0, 50000)} // Limit to avoid token limits

Provide:
1. Relevant section numbers and titles
2. Key excerpts (verbatim from the legislation)
3. Brief explanation of how it applies to the query

Format with clear section references.`;

    const result = await aiModel.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error searching legislation:', error);
    throw error;
  }
}

/**
 * Get a summary of key provisions from legislation
 */
export async function getLegislationSummary(
  legislationType: 'personal-tax' | 'corporate-tax' | 'vat' | 'general',
  legislationText: string,
  apiKey: string,
  model: string = 'gemini-2.0-flash-exp'
): Promise<string> {
  const summaryPrompts = {
    'personal-tax': `Summarize the key provisions related to personal income tax including:
- Tax rates and brackets
- Reliefs and deductions
- Tax credits (APIT, WHT)
- Filing requirements
- Capital gains provisions`,
    
    'corporate-tax': `Summarize the key provisions related to corporate income tax including:
- Tax rates
- Allowable expenses
- Tax incentives
- Filing requirements`,
    
    'vat': `Summarize the key provisions related to Value Added Tax including:
- VAT rates
- Exemptions
- Registration thresholds
- Input tax credits`,
    
    'general': `Provide a structured summary of all major provisions in this legislation.`
  };

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const aiModel = genAI.getGenerativeModel({ model });

    const prompt = `${summaryPrompts[legislationType]}

Tax Legislation:
${legislationText.slice(0, 50000)}

Provide a well-structured summary with section references.`;

    const result = await aiModel.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error getting legislation summary:', error);
    throw error;
  }
}
