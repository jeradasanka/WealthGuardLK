# WealthGuard LK - AI Agent Instructions

## Project Overview
WealthGuard LK is a **zero-knowledge tax planning tool** for Sri Lankan taxpayers. All data is stored locally in browser IndexedDB with AES-GCM encryption. This is a privacy-first React SPA that simulates IRD (Inland Revenue Department) tax calculations to prevent audit risks ("unexplained wealth").

## Architecture Principles

### 1. IRD Cage Mapping (Critical)
Everything maps to IRD form "Asmt_IIT_003_E" cage numbers. **Never invent new fields** - all data structures mirror official IRD schedules:
- **Assets**: `cageCategory` = 'A' (Immovable Property), 'Bi' (Vehicles), 'Bii' (Bank), 'Biii' (Shares), 'Biv' (Cash), 'Bv' (Loans Given), 'Bvi' (Jewellery), 'C' (Business Property)
- **Income Schedules**: '1' (Employment - Cage 901/902/903), '2' (Business - Cage 201/202/203), '3' (Investment - Cage 301/302/303/308)
- **Tax Credits**: APIT = Cage 903, WHT = Cage 908
- **Liabilities**: Cage 781

When adding features, **always reference the IRD cage number** in comments and variable names.

### 2. State Management (Zustand + LocalStorage)
- **Single Store**: `src/stores/useStore.ts` - all app state in one Zustand store
- **Persistence**: Every state mutation calls `saveToStorage()` which encrypts and saves to IndexedDB via `src/utils/storage.ts`
- **Encryption**: User passphrase → PBKDF2 → AES-GCM key (see `src/utils/crypto.ts`)
- **Auto-load**: App checks `getStoredPassphrase()` on mount to restore session

**Pattern**: When adding new data types (like certificates), add:
1. Interface in `src/types/index.ts`
2. State array in `initialState` (useStore.ts)
3. CRUD actions (add/update/remove) in store
4. Update `AppState` type
5. Test encryption/decryption cycle

### 3. Tax Calculation Engine
Located in `src/lib/taxEngine.ts`. Uses **year-specific configs** (TAX_YEAR_CONFIGS):
- Personal relief varies by year (Rs. 3M for 2020-2021, Rs. 1.2M for 2022+)
- Progressive brackets (6%, 12%, 18%, 24%, 30%, 36%)
- Special rules: 25% rent relief (auto-applied), solar relief (min of investment or 600K)

**Key Functions**:
- `computeTax(incomes, entities, taxYear, assets)` - main tax calculator
- `calculateAuditRisk(assets, liabilities, incomes, taxYear)` - "Danger Meter" formula
- `calculateTaxCredits(incomes, certificates, taxYear)` - APIT + WHT totals

**Never hardcode tax rates** - always add new years to TAX_YEAR_CONFIGS.

### 4. Tax Year System
- Format: "2024/2025" (April 1, 2024 - March 31, 2025)
- Helper: `src/lib/taxYear.ts` provides `getCurrentTaxYear()`, `getTaxYearsFromStart()`, `isDateInTaxYear()`
- **All financial data is year-specific**: incomes, balances, expenses, certificates

### 5. Form Component Pattern
All forms follow this structure (see `AssetForm.tsx`, `CertificateForm.tsx`, etc.):
```tsx
export function MyForm({ onClose, itemId?: string }) {
  const entities = useStore(s => s.entities)
  const addItem = useStore(s => s.addItem)
  const updateItem = useStore(s => s.updateItem)
  const [formData, setFormData] = useState<MyType>(initialState)

  // Load existing data if editing
  useEffect(() => { /* load itemId if present */ }, [itemId])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (itemId) updateItem(itemId, formData)
    else addItem(formData)
    onClose()
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

### 6. PDF Import with Gemini AI
**RAMIS Import**: `src/utils/geminiPdfParser.ts`
- Converts PDF to base64, sends to Gemini API with structured prompt
- Returns `ParsedTaxData` with assets, liabilities, incomes, **certificates**
- **Extraction rules** in prompt Sections 1-12 (e.g., Section 7: certificates from Interest Income table with paymentDate)
- PDFImportWizard (`src/components/PDFImportWizard.tsx`): Preview UI with checkboxes, auto-links certificates to income by TIN/payer matching

**Certificate PDF Import**: `src/utils/certificatePdfParser.ts`
- Dedicated parser for WHT/AIT certificate PDFs
- Extracts: certificateNo, issueDate, paymentDate, type, payer details, amounts
- CertificatePDFImportWizard (`src/components/CertificatePDFImportWizard.tsx`): 3-step wizard with entity selection, preview, batch import

**Certificate Linking Logic**:
1. Build Map<TIN, incomeId> from imported incomes
2. Auto-set `relatedIncomeId` if certificate.payerTIN matches
3. Fallback: match by payer name (case-insensitive)

### 7. Routing Structure
`src/App.tsx` uses React Router:
- `/` - Dashboard (entity overview, danger meter, quick actions)
- `/income` - Income schedules by tax year
- `/assets` - Assets grouped by cage category
- `/certificates` - Tax certificates (APIT/WHT) with schedule integration
- `/certificates/new`, `/certificates/edit/:id` - CRUD
- `/tax-computation` - Full tax breakdown
- `/settings` - Export/Import, passphrase, Gemini API config

### 8. Component Library (shadcn/ui)
Uses Radix UI primitives in `src/components/ui/`:
- `Dialog` for modals
- `Card` for grouped content
- `Button` with variants (default, outline, ghost, destructive)
- **Always import from `@/components/ui/`** for consistency

## Development Workflows

### Running the App
```bash
npm run dev         # Starts Vite dev server on port 5183
npm run build       # TypeScript check + production build
npm run preview     # Preview production build
```

### Firebase Deployment
```bash
firebase deploy     # Deploys to https://wealthguard-f7c26.web.app
```

### Key Files to Read First
1. `src/types/index.ts` - All data models (TaxEntity, Asset, Income, AITWHTCertificate)
2. `src/stores/useStore.ts` - State management
3. `src/lib/taxEngine.ts` - Tax calculation logic
4. `README.md` + `SRS.md` - Feature requirements and IRD mappings

### Testing Checklist
- [ ] Add/Edit/Delete works for new entity type
- [ ] Data persists after page refresh (localStorage)
- [ ] Export to JSON includes new data
- [ ] Import from JSON restores new data
- [ ] Tax year filtering works correctly
- [ ] Danger Meter updates when data changes

## Common Patterns

### Adding a New Module (Example: Certificates)
1. **Type Definition** (`src/types/index.ts`):
   ```ts
   export interface AITWHTCertificate {
     id: string; ownerId: string; taxYear: string;
     certificateNo: string; issueDate: string; paymentDate?: string;
     type: 'employment' | 'interest' | 'dividend' | 'rent' | 'other';
     details: { payerName: string; payerTIN: string; grossAmount: number; 
                taxDeducted: number; netAmount: number; description?: string; };
     relatedIncomeId?: string; notes?: string; verified: boolean;
   }
   ```
   **Note**: `paymentDate` is optional and stores when payment was made (if different from issue date)
   
2. **Store Actions** (`src/stores/useStore.ts`):
   ```ts
   certificates: [],
   addCertificate: (cert) => set((state) => ({
     certificates: [...state.certificates, cert]
   })),
   ```
3. **Page Component** (`src/pages/CertificatesPage.tsx`):
   - List view with filters (entity, tax year, type)
   - Summary cards (total count, amounts)
   - CRUD buttons
4. **Form Component** (`src/components/CertificateForm.tsx`):
   - Entity selector
   - Tax year selector (using `getTaxYearsFromStart`)
   - Auto-calculations (e.g., netAmount = grossAmount - taxDeducted)
5. **Routing** (`src/App.tsx`):
   ```tsx
   <Route path="/certificates" element={<CertificatesPage />} />
   ```

### Income-Schedule Integration
Schedule 1 employment income auto-displays in certificate list with:
- Blue background (`bg-blue-50`)
- "From Income Schedule" label
- Disabled edit/delete (managed via IncomePage)
- Auto-verified status

**Pattern**:
```tsx
const scheduleEntries = incomes
  .filter(i => i.schedule === '1' && i.taxYear === selectedYear)
  .map(i => ({
    id: `schedule-${i.id}`,
    type: 'employment',
    details: i.employmentDetails,
    isFromSchedule: true,
  }))
```

### Tax Credit Breakdown
Always show breakdown by source (see `IncomePage.tsx` line 706+):
```tsx
// APIT (Cage 903)
const employmentAPITTotal = incomes.filter(...).reduce(...)
const certificateAPITTotal = certificates.filter(...).reduce(...)

// WHT (Cage 908) by type
const interestWHT = certificates.filter(c => c.type === 'interest')...
```

## Code Quality Standards
- **TypeScript**: Enable strict mode, no `any` types
- **Comments**: Reference IRD cage numbers and SRS functional requirements (e.g., `// FR-12: Certificate Management`)
- **Encryption**: Never log decrypted data - use `console.log('Data loaded')` not `console.log(state)`
- **Error Handling**: Wrap crypto operations in try/catch, show user-friendly errors
- **Date Formats**: Use `date-fns` for formatting, ISO strings for storage

## Security Constraints
- **No Server Calls**: Except Gemini API (user must provide API key)
- **No Analytics**: Zero tracking, fully offline after initial load
- **Passphrase**: Never sent anywhere, only used for PBKDF2 key derivation
- **localStorage**: Only stores encrypted blob, not plain data

## Common Pitfalls
1. **Forgetting tax year filtering**: Most queries need `.filter(i => i.taxYear === selectedYear)`
2. **Not updating exports**: When adding fields, update `src/utils/export.ts` CSV generation
3. **Missing auto-save**: Call `saveToStorage()` after state mutations in forms
4. **Hardcoding relief amounts**: Use TAX_YEAR_CONFIGS instead
5. **Breaking IRD mapping**: Don't rename cage categories without checking SRS

## Reference Links
- IRD Personal Tax Guide: Forms Asmt_IIT_003_E and Schedules 1-10
- SRS.md: Functional requirements FR-01 through FR-13
- README.md: Data models and calculation formulas
