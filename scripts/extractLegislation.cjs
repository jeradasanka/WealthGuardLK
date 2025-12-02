/**
 * Extract legislation PDF to JSON
 * Run this script once to extract PDF content using pdfjs-dist (no API key needed!)
 * Output: public/tax-legislation/extracted/inland-revenue-act-2017.json
 * 
 * Usage: node scripts/extractLegislation.js
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');


async function extractPDF(pdfPath) {
  console.log('📥 Reading PDF from:', pdfPath);
  
  const dataBuffer = await fs.readFile(pdfPath);
  console.log('📦 PDF size:', Math.round(dataBuffer.length / 1024), 'KB');

  console.log('🔄 Parsing PDF with PDF.js...');
  
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(dataBuffer),
    useSystemFonts: true,
  });
  
  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  console.log('📊 Pages:', numPages);

  let fullText = '';
  
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n\n';
    
    if (pageNum % 10 === 0) {
      console.log(`   Processed ${pageNum}/${numPages} pages...`);
    }
  }
  
  console.log('✅ Extraction complete!');
  console.log('📊 Text length:', fullText.length, 'characters');
  
  return fullText;
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const pdfPath = path.join(projectRoot, 'public/tax-legislation/acts/inland-revenue-act-2017.pdf');
  const outputDir = path.join(projectRoot, 'public/tax-legislation/extracted');
  const outputPath = path.join(outputDir, 'inland-revenue-act-2017.json');

  // Create output directory if it doesn't exist
  await fs.mkdir(outputDir, { recursive: true });

  try {
    const extractedText = await extractPDF(pdfPath);
    
    const legislationData = {
      name: 'Inland Revenue Act No. 24 of 2017',
      category: 'act',
      year: 2017,
      extractedAt: new Date().toISOString(),
      content: extractedText,
      metadata: {
        textLength: extractedText.length,
        extractionMethod: 'pdfjs-dist (direct extraction)'
      }
    };

    await fs.writeFile(outputPath, JSON.stringify(legislationData, null, 2));
    console.log('✅ Saved to:', outputPath);
    const stats = await fs.stat(outputPath);
    console.log('📊 File size:', Math.round(stats.size / 1024), 'KB');
    console.log('\n✨ Done! No API key needed - pure PDF parsing!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
