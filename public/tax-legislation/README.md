# Tax Legislation Reference Library

This folder contains Sri Lankan tax legislation that the AI Tax Agent can reference.

## Folder Structure

```
tax-legislation/
├── acts/                    # Source PDF files (for reference)
│   └── inland-revenue-act-2017.pdf
├── extracted/               # Pre-extracted JSON files (used by AI)
│   └── inland-revenue-act-2017.json
├── amendments/             # Year-wise amendments
├── circulars/              # IRD circulars and notices
└── README.md
```

## How It Works

### Performance Optimization
Instead of parsing PDFs on-the-fly (slow, expensive), we:
1. **Extract once** during development using Gemini API
2. **Store as JSON** in `extracted/` folder
3. **Load instantly** when users open the chatbot (no API call!)

### Benefits
- ⚡ **Instant loading** (JSON fetch vs PDF parsing)
- 💰 **No API costs** during normal use
- 📉 **Lower token usage** (pre-extracted text)
- ✅ **No timeouts** or hanging issues

## How to Add New Legislation

### Step 1: Add PDF to Source Folder
```bash
cp inland-revenue-act-2017.pdf public/tax-legislation/acts/
```

### Step 2: Extract to JSON
Run the extraction script (no API key needed!):
```bash
node scripts/extractLegislation.js
```

This will:
- Parse the PDF using pdf-parse library (direct extraction)
- Extract all text content with structure
- Save to `public/tax-legislation/extracted/FILENAME.json`

### Step 3: Register in Code
Update `src/utils/legislationLoader.ts`:
```typescript
export const AVAILABLE_LEGISLATION: LegislationDocument[] = [
  {
    name: 'Inland Revenue Act No. 24 of 2017',
    path: '/tax-legislation/extracted/inland-revenue-act-2017.json',
    category: 'acts',
    year: '2017'
  },
  // Add your new legislation here
];
```

## Naming Convention

Use kebab-case for filenames:
- ✅ `inland-revenue-act-2017.pdf`
- ✅ `amendment-act-1-2024.pdf`
- ✅ `personal-tax-guide-2024.pdf`
- ❌ `Inland Revenue Act 2017.pdf` (spaces)
- ❌ `IRA_2017.pdf` (unclear abbreviation)

## AI Tax Agent Integration

The AI Tax Agent can:
1. **Parse PDFs**: Extract text content from uploaded PDFs
2. **Search**: Find relevant sections based on user questions
3. **Reference**: Cite specific sections/clauses in responses
4. **Context**: Include legislation excerpts in AI prompts

## Recommended PDFs to Add

### Essential Acts
- [ ] Inland Revenue Act No. 24 of 2017 (with latest amendments)
- [ ] Value Added Tax Act No. 14 of 2002
- [ ] Economic Service Charge Act
- [ ] Nation Building Tax Act

### Recent Amendments
- [ ] All 2024 amendments to Inland Revenue Act
- [ ] All 2023 amendments to Inland Revenue Act
- [ ] Budget proposal changes

### IRD Circulars
- [ ] Personal Income Tax Returns Guide
- [ ] Tax Rates and Reliefs (current year)
- [ ] Capital Gains Tax guidelines
- [ ] WHT/APIT guidelines

## File Size Considerations

- Keep individual PDFs under 10MB for faster loading
- If a PDF is too large, consider splitting by sections
- Compress PDFs before uploading (maintain readability)

## Version Control

- Include year/version in filename
- Update README when adding new legislation
- Archive superseded versions in `archived/` subfolder
