# Tax Legislation Reference Library

This folder contains Sri Lankan tax legislation PDFs that the AI Tax Agent can reference.

## Folder Structure

```
tax-legislation/
├── acts/                    # Primary tax legislation
│   ├── inland-revenue-act-2017.pdf
│   ├── vat-act-2002.pdf
│   └── ...
├── amendments/             # Year-wise amendments
│   ├── 2024/
│   │   ├── amendment-act-1-2024.pdf
│   │   └── ...
│   ├── 2023/
│   └── ...
├── circulars/              # IRD circulars and notices
│   ├── personal-tax/
│   ├── corporate-tax/
│   └── ...
└── README.md
```

## How to Add PDFs

1. **Acts**: Place primary legislation PDFs in `acts/` folder
   - Example: `inland-revenue-act-2017.pdf`

2. **Amendments**: Organize by year in `amendments/YYYY/` folders
   - Example: `amendments/2024/amendment-act-1-2024.pdf`

3. **Circulars**: Organize by tax type in `circulars/` subfolders
   - Example: `circulars/personal-tax/ird-circular-2024-01.pdf`

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
