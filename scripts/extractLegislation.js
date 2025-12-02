/**
 * Extract legislation PDF to JSON
 * Run this script once to extract PDF content using Gemini API
 * Output: public/tax-legislation/extracted/inland-revenue-act-2017.json
 * 
 * Usage: node scripts/extractLegislation.js YOUR_GEMINI_API_KEY
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fileToBase64(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
}

async function extractPDF(pdfPath, apiKey, model = 'gemini-2.0-flash-exp') {
  console.log('📥 Reading PDF from:', pdfPath);
  
  const base64Data = await fileToBase64(pdfPath);
  console.log('✅ PDF loaded, size:', Math.round(base64Data.length / 1024), 'KB (base64)');

  console.log('🤖 Sending to Gemini AI for text extraction...');
  const genAI = new GoogleGenerativeAI(apiKey);
  const aiModel = genAI.getGenerativeModel({ model });

  const prompt = `Extract all text content from this Sri Lankan tax legislation PDF (Inland Revenue Act No. 24 of 2017). 

Preserve the complete structure including:
- Section numbers and titles
- Article and clause numbers
- Definitions
- Tables and schedules
- Amendments and provisions

Format as structured text with clear hierarchy. Include ALL sections from Part I to the end.`;

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
  console.log('✅ Extraction complete, text length:', extractedText.length, 'characters');
  
  return extractedText;
}

async function main() {
  const apiKey = process.argv[2];
  
  if (!apiKey) {
    console.error('❌ Error: Gemini API key required');
    console.log('Usage: node scripts/extractLegislation.js YOUR_GEMINI_API_KEY');
    process.exit(1);
  }

  const projectRoot = path.resolve(__dirname, '..');
  const pdfPath = path.join(projectRoot, 'public/tax-legislation/acts/inland-revenue-act-2017.pdf');
  const outputDir = path.join(projectRoot, 'public/tax-legislation/extracted');
  const outputPath = path.join(outputDir, 'inland-revenue-act-2017.json');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const extractedText = await extractPDF(pdfPath, apiKey);
    
    const legislationData = {
      name: 'Inland Revenue Act No. 24 of 2017',
      category: 'act',
      year: 2017,
      extractedAt: new Date().toISOString(),
      content: extractedText,
      metadata: {
        textLength: extractedText.length,
        extractionModel: 'gemini-2.0-flash-exp'
      }
    };

    fs.writeFileSync(outputPath, JSON.stringify(legislationData, null, 2));
    console.log('✅ Saved to:', outputPath);
    console.log('📊 File size:', Math.round(fs.statSync(outputPath).size / 1024), 'KB');
    console.log('\n✨ Done! You can now use this JSON file instead of parsing the PDF.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
