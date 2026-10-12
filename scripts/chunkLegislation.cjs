/**
 * Chunk Legislation JSON into Structured Sections
 * Input: public/tax-legislation/extracted/inland-revenue-act-2017.json
 * Output: public/tax-legislation/extracted/inland-revenue-act-2017-sections.json
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const inputFile = path.join(projectRoot, 'public/tax-legislation/extracted/inland-revenue-act-2017.json');
const outputFile = path.join(projectRoot, 'public/tax-legislation/extracted/inland-revenue-act-2017-sections.json');

const raw = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
const fullText = raw.content;

// 1. Build TOC Map from beginning of Act
const tocEnd = 15249;
const tocText = fullText.slice(0, tocEnd);
const tocMap = {};
const tocRegex = /(\d+[A-Z]?)\.?\s+([A-Za-z][^\n\.]{2,70})/g;
let tocM;
while ((tocM = tocRegex.exec(tocText)) !== null) {
  const num = tocM[1];
  const title = tocM[2].replace(/\s+/g, ' ').trim();
  if (!tocMap[num] && isNaN(Number(title)) && !title.startsWith('of 20') && !title.startsWith('st March') && !title.startsWith('th 20')) {
    tocMap[num] = title;
  }
}

// Known curated titles for important sections
const KNOWN_TITLES = {
  '1': 'Short title and effective date',
  '2': 'Charging provision',
  '3': 'Taxable income',
  '4': 'Assessable income',
  '5': 'Employment income',
  '6': 'Business income',
  '7': 'Investment income',
  '8': 'Other income',
  '9': 'Exempt amounts',
  '10': 'General Deduction',
  '11': 'Main deduction',
  '12': 'Interest expense',
  '13': 'Allowance for trading stock',
  '14': 'Repairs and improvements',
  '15': 'Research and development expenses',
  '15A': 'Marketing and communication expenses',
  '16': 'Capital allowances and balancing allowances',
  '17': 'Losses on realization of business assets and liabilities',
  '18': 'Deductible amount of financial cost',
  '19': 'Business or investment losses',
  '20': 'General rules of deduction',
  '21': 'Cost of asset',
  '22': 'Cost of particular assets',
  '23': 'Realization of asset or liability',
  '24': 'Liabilities and obligations',
  '25': 'Reversal of amounts',
  '26': 'Value of assets and consideration received',
  '27': 'Apportionment of cost and consideration',
  '28': 'Realization with retention of asset',
  '29': 'Transfer of assets to associate',
  '30': 'Involuntary realization of assets',
  '31': 'Finance lease or hire purchase',
  '32': 'Alternative financing principles',
  '33': 'Branch profit tax',
  '34': 'Methods of accounting',
  '35': 'Cash basis accounting',
  '36': 'Accrual basis accounting',
  '37': 'Claim of right',
  '38': 'Long-term contracts',
  '39': 'Trading stock valuation',
  '40': 'Debt obligations and bad debts',
  '41': 'Taxation of individuals',
  '42': 'Income of child',
  '43': 'Partnerships and partners',
  '44': 'Trusts and beneficiaries',
  '45': 'Companies and shareholders',
  '46': 'Dividends and distributions',
  '47': 'Withholding on payments',
  '48': 'Capital gains tax on investment assets',
  '49': 'Mortgage and charges',
  '50': 'Transfer pricing',
  '51': 'Thin capitalization',
  '52': 'Qualifying payments and reliefs',
  '53': 'Personal relief for resident individuals',
  '54': 'Expenditure relief',
  '55': 'Senior citizen relief',
  '56': 'Exempt employment income',
  '57': 'Foreign source income relief',
  '58': 'Double tax relief and international agreements',
  '73': 'Permanent establishment',
  '80': 'Foreign tax credit',
  '82': 'Withholding tax requirements',
  '83': 'Advance Personal Income Tax (APIT) withholding by employers',
  '84': 'Withholding on investment returns (Interest, Dividends, Rent)',
  '85': 'Withholding on service fees and contract payments',
  '86': 'Exemptions from withholding tax',
  '87': 'Withholding tax certificates and statements',
  '88': 'Failure to withhold and withholding liabilities',
  '89': 'Priority of tax withheld',
  '90': 'Credit for withholding tax',
  '91': 'Instalment payment of income tax',
  '92': 'Calculation of instalment payments',
  '93': 'Payment of instalments and due dates',
  '113': 'Filing of tax returns',
  '114': 'Due date and format for returns',
  '115': 'Self-assessment return',
  '116': 'Default and advance assessments',
  '117': 'Amendment of assessments',
  '120': 'Objections to assessments',
  '121': 'Appeals to Tax Appeals Commission',
  '126': 'Refund of overpaid tax',
  '150': 'Interest on unpaid tax',
  '151': 'Late filing and failure to file penalties',
  '152': 'Underpayment and evasion penalties',
  '195': 'Interpretation and definitions',
};

// Schedules definition
const SCHEDULE_DEFS = [
  { name: 'FIRST SCHEDULE', title: 'Tax Rates (Individual Brackets, Corporate & Withholding Rates)', offset: 405750 },
  { name: 'SECOND SCHEDULE', title: 'Investment Incentives & Enhanced Capital Allowances', offset: 442437 },
  { name: 'THIRD SCHEDULE', title: 'Exempt Amounts & Non-Taxable Income', offset: 451124 },
  { name: 'FOURTH SCHEDULE', title: 'Capital Allowances, Balancing Allowances & Depreciation', offset: 478190 },
  { name: 'FIFTH SCHEDULE', title: 'Qualifying Payments and Reliefs', offset: 484223 },
  { name: 'SIXTH SCHEDULE', title: 'Temporary Concessions & Transitional Provisions', offset: 494776 }
];

function cleanText(txt) {
  return txt.replace(/\s+/g, ' ').replace(/www\s*\.\s*ird\s*\.\s*gov\s*\.\s*lk/gi, '').trim();
}

function extractKeywords(text, title) {
  const commonWords = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'from', 'shall', 'under', 'person', 'year', 'assessment', 'income', 'section', 'act', 'subject', 'subsection', 'paragraph', 'subparagraph']);
  const words = (title + ' ' + text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !commonWords.has(w));
  return Array.from(new Set(words)).slice(0, 25);
}

const bodyText = fullText.slice(tocEnd);
const schedulesStart = SCHEDULE_DEFS[0].offset;
const sectionsBody = bodyText.slice(0, schedulesStart);

// Extract sections
const sectionRegex = /(?:^|\s+)(\d{1,3}[A-Z]?)\.\s+(?:\([0-9a-z]+\)|[A-Z])/g;
let match;
const sectionMarkers = [];

while ((match = sectionRegex.exec(sectionsBody)) !== null) {
  const secNum = match[1];
  sectionMarkers.push({
    secNum,
    index: match.index
  });
}

// Group sequential markers by section number to avoid subsection duplicate chunks
const uniqueSectionMarkers = [];
const seenNums = new Set();
for (let i = 0; i < sectionMarkers.length; i++) {
  const m = sectionMarkers[i];
  if (!seenNums.has(m.secNum)) {
    seenNums.add(m.secNum);
    uniqueSectionMarkers.push(m);
  }
}

// Sort markers by index
uniqueSectionMarkers.sort((a, b) => a.index - b.index);

const chunks = [];

// Create section chunks
for (let i = 0; i < uniqueSectionMarkers.length; i++) {
  const curr = uniqueSectionMarkers[i];
  const next = uniqueSectionMarkers[i + 1] || { index: sectionsBody.length };
  
  const rawChunk = sectionsBody.slice(curr.index, next.index);
  const content = cleanText(rawChunk);
  
  if (content.length < 20) continue;
  
  const secNum = curr.secNum;
  const title = KNOWN_TITLES[secNum] || tocMap[secNum] || `Section ${secNum}`;
  const keywords = extractKeywords(content, title);
  
  chunks.push({
    id: `ira-2017-sec-${secNum.toLowerCase()}`,
    actName: 'Inland Revenue Act No. 24 of 2017',
    type: 'section',
    number: secNum,
    title,
    content,
    keywords
  });
}

// Create schedule chunks
for (let i = 0; i < SCHEDULE_DEFS.length; i++) {
  const curr = SCHEDULE_DEFS[i];
  const next = SCHEDULE_DEFS[i + 1];
  const startPos = curr.offset;
  const endPos = next ? next.offset : bodyText.length;
  
  const rawSched = bodyText.slice(startPos, endPos);
  const content = cleanText(rawSched);
  
  if (content.length < 50) continue;
  
  const keywords = extractKeywords(content, curr.title);
  
  chunks.push({
    id: `ira-2017-${curr.name.toLowerCase().replace(/\s+/g, '-')}`,
    actName: 'Inland Revenue Act No. 24 of 2017',
    type: 'schedule',
    number: curr.name,
    title: curr.title,
    content,
    keywords
  });
}

console.log(`Generated ${chunks.length} structured legislation chunks!`);
fs.writeFileSync(outputFile, JSON.stringify(chunks, null, 2));
console.log(`Saved to ${outputFile}`);
const stats = fs.statSync(outputFile);
console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);
