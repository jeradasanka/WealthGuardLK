# WealthGuard LK

**Zero-Knowledge Personal Tax Tracker for Sri Lankan Taxpayers**

WealthGuard LK is a privacy-first, offline-first web application designed to help Sri Lankan individuals and families track their financial portfolio (Assets, Liabilities, Income) and mathematically prove the source of funds for every asset acquired. It serves as a pre-audit tool to prevent "unexplained wealth" flags before filing the official IRD return.

## 🔐 Key Features

- **Zero-Knowledge Privacy**: All data encrypted with AES-GCM and stored locally in your browser using IndexedDB
- **Offline-First**: Works 100% offline - no data ever sent to any server
- **Audit Risk Detection**: Real-time "Danger Meter" warns about unexplained wealth
- **IRD Compliance**: Generates filled values for IRD Schedules (1-10) and Statement of Assets & Liabilities
- **Family Wealth Tracking**: Manage multiple taxpayer profiles (husband, wife) with joint asset management
- **Source of Funds Validation**: Links every asset acquisition to its funding source

## 🏗️ Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Shadcn UI
- **State Management**: Zustand
- **Storage**: IndexedDB (via idb-keyval)
- **Encryption**: Web Crypto API (AES-GCM + PBKDF2)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The app will be available at `http://localhost:5173`

## 📋 Core Modules

### 1. Tax Entity Management (FR-01)
- Create profiles for primary taxpayer and spouse
- Fields: Name, TIN, Mobile, Email
- Configure joint asset split ratios

### 2. Income & Schedule Mapper (FR-02, FR-03, FR-04)
- **Schedule 1**: Employment Income with APIT deductions
- **Schedule 2**: Business Income with net profit calculations
- **Schedule 3**: Investment Income with WHT handling and rent relief (25%)

### 3. Asset & Liability Tracking (FR-05, FR-06)
- **Assets**: Immovable Property (701), Vehicles (711), Bank/Financial (721)
- **Liabilities**: Loans with security given and current balances
- Maps directly to IRD Statement of Assets and Liabilities

### 4. Source of Funds Linker (FR-07)
- Asset Acquisition Wizard prompts for funding source:
  - Current year income
  - Asset liquidation
  - New loans
  - Gift/Inheritance
- Alerts on unexplained wealth

### 5. Tax Calculation Engine (FR-08, FR-09)
- Automatic relief application (Personal: Rs. 1,200,000, Solar: up to Rs. 600,000)
- Progressive tax rates (6%, 12%, 18%, 24%, 30%, 36%)
- Tax credit handling (APIT, WHT)

### 6. Danger Meter (FR-10)
- **Formula**: `(Asset Growth + Living Expenses) - (Declared Income + Loans)`
- Visual indicators: Green (Safe), Yellow (Warning), Red (Danger)
- Real-time risk score calculation

### 7. Export Functionality (FR-11)
- Encrypted JSON backup
- IRD Schedule 7 CSV for WHT certificates

## 🔒 Security Architecture

```
User Passphrase
     ↓ PBKDF2 (100,000 iterations)
Encryption Key (AES-256)
     ↓ AES-GCM
Encrypted Data → IndexedDB (Browser)
```

- Encryption key derived from user passphrase using PBKDF2
- Data encrypted before saving to IndexedDB
- No analytics trackers or external API calls
- Passphrase hash stored for validation (not the passphrase itself)

## 📊 Data Model

### AppState
```typescript
{
  entities: TaxEntity[]
  assets: Asset[]
  liabilities: Liability[]
  incomes: Income[]
  currentTaxYear: string
  jointAssetSplitRatio: { [entityId: string]: number }
  isEncrypted: boolean
  lastSaved?: string
}
```

See `src/types/index.ts` for complete type definitions.

## 🛣️ Development Roadmap

- [x] **Phase 1**: Project setup with React + Vite + Zustand + IndexedDB
- [x] **Phase 2**: Encryption layer and storage utilities
- [x] **Phase 3**: Core UI components (Danger Meter, Entity Form)
- [x] **Phase 4**: Tax calculation engine
- [ ] **Phase 5**: Income schedule forms (Schedules 1-3)
- [ ] **Phase 6**: Asset and Liability management UI
- [ ] **Phase 7**: Source of Funds wizard
- [ ] **Phase 8**: Export functionality (JSON + CSV)
- [ ] **Phase 9**: Testing and IRD compliance validation

## 📖 IRD Reference

This application follows the Sri Lankan Inland Revenue Department's Personal Income Tax Guide. All field labels and calculations match the official IRD forms:
- Form Asmt_IIT_003_E (Personal Income Tax Return)
- Schedules 1-10
- Statement of Assets and Liabilities

## ⚠️ Disclaimer

This is a personal tax planning tool and does not replace professional tax advice. Always consult with a qualified tax professional before filing your returns.

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

This is a personal project, but suggestions and bug reports are welcome via GitHub issues.

---

**Built with ❤️ for Sri Lankan taxpayers**
