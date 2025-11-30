/**
 * Test script to parse the sample RAMIS PDF and analyze its structure
 */

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const fs = require('fs');

// Load the PDF file
const pdfPath = './samples/Sample_RAMIS.pdf';
const data = new Uint8Array(fs.readFileSync(pdfPath));

async function parsePDF() {
  try {
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    console.log(`PDF loaded: ${pdf.numPages} pages\n`);

    let fullText = '';
    
    for (let i = 1; i <= Math.min(pdf.numPages, 4); i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`PAGE ${i}`);
      console.log('='.repeat(60));
      console.log(pageText);
      
      fullText += pageText + '\n\n';
    }

    // Try to extract key information
    console.log('\n\n' + '='.repeat(60));
    console.log('EXTRACTION ANALYSIS');
    console.log('='.repeat(60));

    // Look for tax year
    const yearMatch = fullText.match(/Y\/A\s*(\d{4}\/\d{4}|\d{4})/i);
    console.log('Tax Year:', yearMatch ? yearMatch[1] : 'Not found');

    // Look for TIN
    const tinMatch = fullText.match(/TIN[:\s]*(\d{9}V?|\d{12})/i);
    console.log('TIN:', tinMatch ? tinMatch[1] : 'Not found');

    // Look for name patterns
    const nameMatch = fullText.match(/Name[:\s]*([A-Z][a-zA-Z\s\.]+)/);
    console.log('Name:', nameMatch ? nameMatch[1].trim() : 'Not found');

    // Look for asset categories
    console.log('\nAsset Categories Found:');
    const categories = ['Section A', 'Section Bi', 'Section Bii', 'Section Biii', 'Section Biv', 'Section Bv', 'Section Bvi', 'Section C', 'Section D'];
    categories.forEach(cat => {
      if (fullText.includes(cat)) {
        console.log(`  ✓ ${cat}`);
      }
    });

    // Look for income sections
    console.log('\nIncome Sections Found:');
    const incomeSections = ['Employment', 'Business', 'Profession', 'Investment', 'Interest', 'Dividend', 'Rent'];
    incomeSections.forEach(section => {
      if (fullText.toLowerCase().includes(section.toLowerCase())) {
        console.log(`  ✓ ${section}`);
      }
    });

  } catch (error) {
    console.error('Error parsing PDF:', error);
  }
}

parsePDF();
