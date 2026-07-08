# WealthGuard LK - Quick Start Guide

## 🎯 Application Status

The WealthGuard LK application is **complete and deployed** at https://wealthguard.web.app

## ✅ Working Features

### 1. **Complete Setup Flow**
- Welcome screen with option to create new profile or import backup
- Passphrase creation with random generation option
- Initial taxpayer profile creation
- Import backup during setup to skip profile creation
- All data encrypted before storage in localStorage

### 2. **Dashboard**
- Summary cards showing:
  - Total Assets
  - Total Liabilities  
  - Net Worth
  - Current Year Income
- Real-time Danger Meter with audit risk calculation
- Entity/Family view switcher
- Tax year selector
- PDF import wizard for income certificates
- Quick navigation to all sections

### 3. **Security System**
- AES-GCM encryption with 256-bit keys
- PBKDF2 key derivation (100,000 iterations)
- All data stored in browser localStorage (larger capacity than cookies)
- Zero external API calls
- Encrypted backup files (.wglk format)

### 4. **Tax Calculation Engine**
- Progressive tax rates (6% to 36%)
- Personal relief (Rs. 1,200,000)
- Solar relief (up to Rs. 600,000)
- APIT and WHT tax credit handling
- 25% rent relief for rental income
- Complete audit risk algorithm

### 5. **Income Management**
- Employment Income Form (Schedule 1)
- Business Income Form (Schedule 2)
- Investment Income Form (Schedule 3)
- Tax year filtering
- Entity ownership tracking

### 6. **Asset & Liability Tracking**
- Asset categories: Immovable Property (701), Vehicles (711), Financial (721)
- Liability tracking with loan details
- Joint ownership management
- Disposal tracking
- Maps to IRD Statement of Assets and Liabilities

### 7. **Backup & Restore**
- Export encrypted backups (.wglk files)
- Import backups from Settings or during Setup
- IRD Schedule 7 CSV export for WHT
- Summary report generation

### 8. **Settings & Management**
- Family member management
- Passphrase change
- Tax year configuration
- Clear all data option
- Backup and restore functionality

2. **Business Income Form** (Schedule 2)
   ```typescript
   - Business Name
   - Gross Revenue
   - Direct Expenses
   - Net Profit (auto-calculated)
   ```

3. **Investment Income Form** (Schedule 3)
   ```typescript
   - Type: Interest/Dividend/Rent
   - Source
   - Gross Amount
   - WHT Deducted
   - Auto-apply 25% relief for rent
   ```

### Priority 2: Asset & Liability Management
Create list and form components for:

1. **Assets**
   - Immovable Property (701): Address, Deed No, Cost
   - Vehicles (711): Reg No, Brand, Cost
   - Bank/Financial (721): Account No, Bank Name

2. **Liabilities**
   - Lender Name
   - Original Amount
   - Current Balance
   - Security Given

### Priority 3: Source of Funds Wizard
Multi-step wizard that asks "How did you pay for this asset?":
- Current year income
- Sale of another asset
- New loan
- Gift/Inheritance
- Savings

Alerts if source < cost (unexplained wealth)

### Priority 4: Export Features
- JSON backup with encryption
- IRD Schedule 7 CSV for WHT certificates

## 🏃 Running the App

### Production (Live)
```bash
# Access the deployed application
https://wealthguard.web.app
```

### Development
```bash
# Start development server
npm run dev

# Build for production
npx vite build

# Deploy to Firebase
firebase deploy
```

## 📂 Code Organization

```
Key Files:
├── src/stores/useStore.ts           # Zustand state management
├── src/lib/taxEngine.ts             # Tax calculation logic
├── src/utils/storage.ts             # localStorage encryption
├── src/utils/export.ts              # Backup/export utilities
├── src/components/                  # Reusable components
│   ├── ImportDialog.tsx             # Backup import
│   ├── ExportDialog.tsx             # Backup export
│   ├── PDFImportWizard.tsx          # PDF income import
│   └── EntityForm.tsx               # Entity management
├── src/pages/                       # Main pages
│   ├── Dashboard.tsx                # Main dashboard
│   ├── Setup.tsx                    # Initial setup flow
│   ├── SettingsPage.tsx             # Settings & backup
│   ├── AssetsPage.tsx               # Asset management
│   ├── IncomePage.tsx               # Income tracking
│   └── TaxComputationPage.tsx       # Tax calculation
└── src/types/index.ts               # TypeScript definitions
```

## 🎨 Example: Using the Store

```typescript
// Add income
export function EmploymentIncomeForm() {
  const addIncome = useStore((state) => state.addIncome);
  const saveToStorage = useStore((state) => state.saveToStorage);
  
  const handleSubmit = async (data) => {
    const income: EmploymentIncome = {
      id: crypto.randomUUID(),
      ownerId: selectedEntityId,
      type: 'employment',
      schedule: '1',
      taxYear: currentTaxYear,
      details: {
        employerName: data.employerName,
        employerTIN: data.employerTIN,
        grossAmount: data.grossRemuneration,
        grossRemuneration: data.grossRemuneration,
        nonCashBenefits: data.nonCashBenefits,
        apitDeducted: data.apitDeducted,
        exemptIncome: 0,
      },
    };
    addIncome(income);
    await saveToStorage(); // Persist to localStorage
  };
  
  return <form onSubmit={handleSubmit}>...</form>
}
```

## 🔐 Security Architecture

- Passphrase is NEVER stored (only its hash for validation)
- All data encrypted before localStorage storage
- Encryption key derived from passphrase via PBKDF2 (100,000 iterations)
- Each save uses new random IV (Initialization Vector)
- localStorage used instead of cookies (larger storage capacity)
- Backup files (.wglk) are fully encrypted and portable

## 💾 Storage & Backup

### localStorage Structure
```
wealthguard_lk_data            → Encrypted AppState
wealthguard_lk_passphrase_hash → Passphrase validation hash
wealthguard_lk_passphrase      → Stored for convenience (optional)
```

### Backup Files (.wglk)
- WealthGuard LK encrypted backup format
- Contains full encrypted AppState
- Requires original passphrase to decrypt
- Can be imported during setup or from settings

## 📊 Tax Calculation Flow

```
User Input (Incomes) 
    ↓
calculateTotalIncome()
    ↓
Apply Reliefs (Personal + Solar)
    ↓
calculateProgressiveTax()
    ↓
Deduct Tax Credits (APIT + WHT)
    ↓
Tax Payable
```

## 🚨 Danger Meter Formula

```
Risk Score = (Assets Acquired This Year + Living Expenses)
           - (Income This Year + New Loans This Year)

Green:  Risk ≤ Rs. 100,000 (Safe)
Yellow: Rs. 100,000 < Risk ≤ Rs. 500,000 (Warning)
Red:    Risk > Rs. 500,000 (Danger - Unexplained Wealth!)
```

## 🎯 Feature Completion Status

- [x] Project setup and infrastructure ✅
- [x] Encryption and storage (localStorage) ✅
- [x] Type system ✅
- [x] State management (Zustand) ✅
- [x] Tax engine ✅
- [x] Dashboard UI ✅
- [x] Setup flow with import option ✅
- [x] Danger Meter ✅
- [x] Income forms (3 schedules) ✅
- [x] Asset management ✅
- [x] Liability management ✅
- [x] Source of funds tracking ✅
- [x] Export functionality (.wglk, CSV, PDF) ✅
- [x] Import functionality ✅
- [x] Tax computation view ✅
- [x] Settings page ✅
- [x] PDF import wizard ✅
- [x] Firebase deployment ✅

**Status: Production Ready - Deployed at https://wealthguard.web.app**

## 🆘 Common Tasks

### Add a new entity
```typescript
const entity: TaxEntity = {
  id: crypto.randomUUID(),
  name: "John Doe",
  tin: "123456789V",
  mobile: "0771234567",
  email: "john@example.com",
  role: "primary",
  createdAt: new Date().toISOString(),
};
addEntity(entity);
await saveToStorage();
```

### Add an asset
```typescript
const asset: Asset = {
  id: crypto.randomUUID(),
  ownerId: entityId,
  cageCategory: "711", // Vehicle
  meta: {
    description: "Toyota Prius",
    dateAcquired: "2024-01-15",
    regNo: "ABC-1234",
    brand: "Toyota",
  },
  financials: {
    cost: 8500000,
    marketValue: 8200000,
    sourceOfFunds: [
      { type: 'loan', loanId: loanId, amount: 5000000 },
      { type: 'savings', description: 'Bank savings', amount: 3500000 }
    ]
  }
};
addAsset(asset);
await saveToStorage();
```

## 📚 References

- **SRS.md**: Complete requirements specification
- **IMPLEMENTATION.md**: Detailed implementation guide
- **README.md**: Project overview
- **IRD Guide**: [Inland Revenue Department Guide](http://www.ird.gov.lk/)

---

**Built with React + TypeScript + Vite + Zustand + IndexedDB**

**Status**: Core complete, feature development ready 🚀
