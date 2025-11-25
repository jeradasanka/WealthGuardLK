# WealthGuard LK - Quick Start Guide

## 🎯 What You Have Now

The WealthGuard LK application is **60% complete** with all core infrastructure in place. The development server is running at **http://localhost:5173**

## ✅ Working Features

### 1. **Complete Setup Flow**
- Welcome screen explaining zero-knowledge privacy
- Passphrase creation with random generation option
- Initial taxpayer profile creation
- All data encrypted before storage

### 2. **Dashboard**
- Summary cards showing:
  - Total Assets
  - Total Liabilities  
  - Net Worth
  - Current Year Income
- Real-time Danger Meter with audit risk calculation
- Entity profile listing
- Quick action cards (UI ready, forms pending)

### 3. **Security System**
- AES-GCM encryption with 256-bit keys
- PBKDF2 key derivation (100,000 iterations)
- All data stored in browser IndexedDB
- Zero external API calls

### 4. **Tax Calculation Engine**
- Progressive tax rates (6% to 36%)
- Personal relief (Rs. 1,200,000)
- Solar relief (up to Rs. 600,000)
- APIT and WHT tax credit handling
- 25% rent relief for rental income
- Complete audit risk algorithm

## 🔨 What to Build Next

### Priority 1: Income Forms (Essential)
Create three forms to allow users to input their income:

1. **Employment Income Form** (Schedule 1)
   ```typescript
   - Employer Name & TIN
   - Gross Remuneration
   - Non-Cash Benefits
   - APIT Deducted
   ```

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

```bash
# Already running at:
http://localhost:5173

# To rebuild if needed:
npm run dev

# To build for production:
npm run build
```

## 📂 Code Organization

```
Key Files to Know:
├── src/stores/useStore.ts       # Add your data here
├── src/lib/taxEngine.ts         # Tax calculation logic
├── src/components/               # Add new forms here
├── src/pages/Dashboard.tsx      # Main UI
└── src/types/index.ts           # Type definitions
```

## 🎨 Adding a New Form (Example)

```typescript
// 1. Create component
export function EmploymentIncomeForm() {
  const addIncome = useStore((state) => state.addIncome);
  
  const handleSubmit = (data) => {
    const income: EmploymentIncome = {
      id: crypto.randomUUID(),
      ownerId: selectedEntityId,
      schedule: '1',
      taxYear: currentTaxYear,
      details: {
        employerName: data.employerName,
        employerTIN: data.employerTIN,
        grossRemuneration: data.grossRemuneration,
        nonCashBenefits: data.nonCashBenefits,
        apitDeducted: data.apitDeducted,
        exemptIncome: 0,
      },
    };
    addIncome(income);
    await saveToStorage(); // Persist
  };
  
  return <form onSubmit={handleSubmit}>...</form>
}
```

## 🔐 Security Reminders

- Passphrase is NEVER stored (only its hash for validation)
- All data encrypted before IndexedDB storage
- Encryption key derived from passphrase via PBKDF2
- Each save uses new random IV (Initialization Vector)

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

## 🎯 MVP Completion Checklist

- [x] Project setup and infrastructure
- [x] Encryption and storage
- [x] Type system
- [x] State management
- [x] Tax engine
- [x] Dashboard UI
- [x] Setup flow
- [x] Danger Meter
- [ ] Income forms (3 schedules)
- [ ] Asset management
- [ ] Liability management
- [ ] Source of funds wizard
- [ ] Export functionality
- [ ] Tax computation view
- [ ] Settings page

**Estimated time to MVP: 6-10 days**

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
