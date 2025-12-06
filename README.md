# WealthGuard LK

**Zero-Knowledge Personal Tax Tracker for Sri Lankan Taxpayers**

WealthGuard LK is a privacy-first, offline-first web application designed to help Sri Lankan individuals and families track their financial portfolio (Assets, Liabilities, Income) and mathematically prove the source of funds for every asset acquired. It serves as a pre-audit tool to prevent "unexplained wealth" flags before filing the official IRD return.

## 🔐 Key Features

- **Zero-Knowledge Privacy**: All data encrypted with AES-GCM and stored locally in browser localStorage
- **Offline-First**: Works 100% offline - no data ever sent to any server
- **Backup & Restore**: Import/Export encrypted backups (.wglk files) with passphrase protection
- **Audit Risk Detection**: Real-time "Danger Meter" warns about unexplained wealth
- **IRD Compliance**: Generates filled values for IRD Schedules (1-10) and Statement of Assets & Liabilities
- **Tax Certificate Tracking**: Track APIT and WHT certificates with automatic linking to income entries
- **Family Wealth Tracking**: Manage multiple taxpayer profiles (husband, wife) with joint asset management
- **Source of Funds Validation**: Links every asset acquisition to its funding source
- **Tax Certificate Management**: Complete APIT/WHT certificate tracking with auto-linking to income
- **PDF Import (AI-Powered)**: Import from multiple PDF types using Gemini AI
  - IRD RAMIS PDFs (income schedules, certificates, assets, liabilities)
  - Income Schedule T10 forms (employment, business, investment)
  - Bank statements and account summaries (financial asset balances)
  - Loan statements and payment receipts (liability payments)
  - Tax certificate PDFs (APIT/WHT certificates)
- **AI Tax Agent**: Conversational AI chatbot for personalized tax advice
  - Auto-analysis of current financial situation and audit risk
  - Sri Lankan tax law expertise via Gemini AI
  - Context-aware recommendations and optimization strategies
  - Integrated into Audit Risk Meter for immediate access

## 🏗️ Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Shadcn UI
- **State Management**: Zustand
- **Storage**: Browser localStorage (encrypted)
- **Encryption**: Web Crypto API (AES-GCM + PBKDF2)
- **AI Integration**: Google Gemini AI (PDF parsing, tax advice)
- **PDF Processing**: pdfjs-dist (legislation extraction), Gemini AI (document import)
- **Hosting**: Firebase Hosting

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
- **Schedule 1**: Employment Income with APIT deductions and exempt income tracking
- **Schedule 2**: Business Income with net profit calculations
- **Schedule 3**: Investment Income with WHT handling and rent relief (25%)
- **Schedule 4**: Other Income (royalties, prizes, pensions, gratuities, annuities, lottery) with exempt amount tracking

### 3. Asset & Liability Tracking (FR-05, FR-06)
- **Assets**: Immovable Property (701), Vehicles (711), Bank/Financial (721)
- **Liabilities**: Loans with security given and current balances
- Maps directly to IRD Statement of Assets and Liabilities

### 4. Tax Certificate Tracking (FR-12, FR-13)
- **APIT Certificates**: Track employment tax deduction certificates (Cage 903)
- **WHT Certificates**: Interest, dividend, rent, and other withholding tax certificates (Cage 908)
- **Auto-Import**: Extract certificates from RAMIS PDFs via AI parsing
- **Income Linking**: Automatically link certificates to related income entries by TIN/payer matching
- **Verification Status**: Mark certificates as verified against original documents
- **Tax Credit Breakdown**: View detailed breakdown of all tax credits by type and source

### 5. Source of Funds Linker (FR-07)
- Asset Acquisition Wizard prompts for funding source:
  - Current year income
  - Asset liquidation
  - New loans
  - Gift/Inheritance
- Alerts on unexplained wealth

### 6. Tax Calculation Engine (FR-08, FR-09)
- Automatic relief application (Personal: Rs. 1,200,000, Solar: up to Rs. 600,000)
- Progressive tax rates (6%, 12%, 18%, 24%, 30%, 36%)
- Tax credit handling (APIT from employment and certificates, WHT from certificates)

### 7. Danger Meter (FR-10)
- **Entity-Based Filtering**: Calculates risk per selected entity (family combined or individual)
- **Derived Living Expenses**: Automatically calculates living expenses as balance of inflows minus outflows (no estimation needed)
- **Formula**: `Risk_Score = Total_Outflows - Total_Inflows`
  - **Inflows**: Employment + Business + Investment Income + New Loans + Asset Sales
  - **Outflows**: Tax Deducted + Asset Purchases + Property Expenses + Loan Principal + Loan Interest + Living Expenses (derived)
- **Comprehensive Breakdown**: Pie chart visualization showing all 10 income/expense categories
  - 5 inflow categories (employment, business, investment, loans, asset sales)
  - 6 outflow categories (tax, asset purchases, property expenses, loan principal, interest, living expenses)
- **Visual Indicators**: Green (Safe), Yellow (Warning), Red (Danger)
- **Real-time Updates**: Risk score recalculates when switching between family and individual entity views
- **Tax Year Display**: Shows selected entity and tax year in meter header
- **AI Tax Agent**: Integrated chatbot button for instant tax advice

### 7a. AI Tax Agent Chatbot (FR-15)
- **Auto-Analysis**: Immediate comprehensive tax situation analysis on entry
- **Conversational AI**: Ask follow-up questions about tax planning and compliance
- **Financial Context**: AI receives full taxpayer data (income, assets, liabilities, tax computation)
- **Legislation Integration**: Pre-extracted Inland Revenue Act No. 24 of 2017 loaded instantly
  - 524,462 characters of full tax legislation text
  - AI provides specific section references in advice (e.g., "Section 3 of the Inland Revenue Act")
  - Build-time PDF extraction (no runtime API calls for legislation)
  - Instant loading (< 1 second vs previous 60+ second timeout)
- **Model Selection**: Choose between Gemini 2.0 Flash, 1.5 Pro, or 1.5 Flash (same as PDF import)
- **Entity & Tax Year Filter**: Focus analysis on specific taxpayer and year
- **Advice Categories**:
  - Tax compliance status and immediate concerns
  - Audit risk analysis with legislative citations
  - Legal optimization opportunities with Act references
  - Specific pre-filing recommendations
  - Potential red flags identification with regulatory context

### 8. Export & Import (FR-11)
- **Export**: Encrypted JSON backup (.wglk files)
- **Import**: Restore data from backup during setup or from settings
- **IRD Schedule 7**: CSV export for WHT certificates

### 9. AI-Powered PDF Import (FR-14)
- **RAMIS Import**: Extract income, assets, liabilities, and certificates from IRD RAMIS PDFs
- **Income Schedule Import**: Import T10 forms (Schedules 1, 2, 3) with auto-detection
- **Financial Balance Import**: Extract balance records from bank statements
  - Opening balance, closing balance, interest earned
  - Account details (number, holder name, bank name)
  - Statement period auto-detection
  - Tax year auto-assignment based on statement dates
- **Liability Payment Import**: Extract payment records from loan documents
  - Principal paid, interest paid, total payment
  - Balance after payment tracking
  - Payment date and reference extraction
  - Loan account and lender information
- **Certificate Import**: Dedicated parser for APIT/WHT certificate PDFs
- **Model Selection**: Choose between Gemini 2.0 Flash, 1.5 Pro, or 1.5 Flash
- **OCR Support**: Handles scanned documents (images converted to text)
- **Smart Filtering**: Entity filter and tax year override for each imported record
- **Preview & Select**: Review extracted data before importing with selective import

## 📊 Data Structures & Calculations

### 1. Data Models

The application uses a strictly typed data model defined in `src/types/index.ts`.

#### Tax Entity (`TaxEntity`)
Represents a taxpayer (Individual, Partnership, Company).
- **Key Fields**: `id`, `name`, `tin`, `type`, `role` (primary/spouse).
- **Usage**: All assets, liabilities, and incomes are linked to an `ownerId` corresponding to a Tax Entity.

#### Asset (`Asset`)
Represents a physical or financial asset owned by an entity.
- **Categories (`cageCategory`)**: Maps directly to IRD Return of Income schedules:
  - `A`: Immovable Properties
  - `Bi`: Motor Vehicles
  - `Bii`: Bank Balances / Term Deposits
  - `Biii`: Shares/Stocks/Securities (with detailed portfolio tracking)
  - `Biv`: Cash in Hand
  - `Bv`: Loans Given
  - `Bvi`: Jewellery/Gold
  - `C`: Business Properties
- **Valuation**: Tracks both `cost` (for acquisition proof) and `marketValue` (for net worth).
- **Joint Ownership**: Supports `ownershipShares` to split value between family members.
- **Stock Portfolios (Biii)**: Enhanced tracking with CDS account management
  - CDS Account Number, Broker Name, Broker Code
  - Yearly balance records with detailed holdings
  - Per-stock tracking: Symbol, quantity, prices, cost basis, market value
  - Dividend income tracking per stock (even for zero-quantity positions)
  - Cash balance in broker account
  - Net cash transfers (deposits to/withdrawals from broker)
  - Auto-calculated portfolio valuation and unrealized gains

#### Liability (`Liability`)
Represents a debt obligation.
- **Key Fields**: `originalAmount`, `currentBalance`, `lenderName`, `securityGiven`.
- **Payment Tracking**: Records principal and interest payments to calculate reducing balance.
- **Annual Records**: `payments` array tracks payment history by tax year
  - Each payment: `{ id, taxYear, date, principalPaid, interestPaid, notes }`
  - Auto-calculates balance reduction
  - Interest paid flows to tax deductible expenses

#### FinancialAssetBalance
Represents annual balance records for financial assets (Bank/Term Deposits, Cash, Loans Given).
- **Key Fields**: `taxYear`, `closingBalance`, `interestEarned`
- **Usage**: Tracks year-end balances for Cage Bii, Biv, Bv assets
- **Auto-calculation**: Interest earned flows to Investment Income (Schedule 3)
- **Import Source**: Can be manually entered or imported from bank statement PDFs

#### StockBalance
Represents annual balance records for stock portfolios (Cage Biii - Shares/Stocks).
- **Key Fields**: `taxYear`, `portfolioValue`, `brokerCashBalance`, `cashTransfers`, `holdings`
- **Holdings Array**: Detailed list of individual stock positions (see StockHolding below)
- **Auto-calculations**: 
  - `portfolioValue`: Sum of all holdings' market values
  - `purchases`: Sum of all holdings' total costs
  - `dividends`: Sum of all holdings' dividend income
- **Cash Tracking**:
  - `cashTransfers`: Net cash deposited to (+) or withdrawn from (-) broker account
  - Deposits flow to audit risk as outflows (investment)
  - Withdrawals flow to audit risk as inflows (divestment)
- **Usage**: Tracks year-end portfolio state for stock investments

#### StockHolding
Represents individual stock positions within a portfolio.
- **Key Fields**: `symbol`, `companyName`, `quantity`, `averageCost`, `currentPrice`, `dividendIncome`
- **Auto-calculations**:
  - `totalCost`: quantity × averageCost (cost basis)
  - `marketValue`: quantity × currentPrice (current valuation)
  - `unrealizedGain`: marketValue - totalCost (paper gains/losses)
- **Dividend Tracking**: `dividendIncome` tracks total dividends received during tax year
  - Can be non-zero even when quantity is 0 (for sold stocks that paid dividends)
  - Flows to Investment Income (Schedule 3) as dividend income
  - Each stock's dividends shown separately in derived income breakdown
- **Usage**: Enables detailed stock-by-stock portfolio analysis and tax reporting

#### Income (`Income`)
Represents an income source for a specific tax year.
- **Schedules**:
  - Schedule 1: Employment Income (Cage 101-199: Gross 103, Non-Cash Benefits 104, Exempt Income, APIT 903)
  - Schedule 2: Business Income (Cage 201 - Gross, 202 - Expenses, 203 - Net)
  - Schedule 3: Investment Income (Cage 301 - Interest, 302 - Dividends, 303 - Rent, 304 - Other, 308 - WHT)
  - Schedule 4: Other Income (Cage 401 - Gross, 402 - Exempt, WHT if applicable)
    - Types: Royalty, Annuity, Prize/Award, Lottery, Pension, Gratuity, Other
- **Tax Deductions**: Captures APIT (Cage 903) and WHT (Cage 308/908) at source.
- **Exempt Income**: Employment and Other Income support exempt amount tracking (automatically excluded from taxable income)

#### AITWHTCertificate (`AITWHTCertificate`)
Represents a tax certificate for APIT or WHT deductions.
- **Types**: 
  - `employment`: APIT certificates from employers (Cage 903)
  - `interest`, `dividend`, `rent`, `other`: WHT certificates from various income sources (Cage 908)
- **Key Fields**: 
  - `certificateNo`: Unique certificate number
  - `issueDate`: Certificate issue date
  - `taxYear`: Tax year the certificate applies to
  - `details`: Payer information (name, TIN), gross amount, tax deducted, net amount
  - `relatedIncomeId`: Links to corresponding income entry (auto-linked by TIN/payer matching)
  - `verified`: Manual verification status flag
- **Auto-calculation**: `netAmount = grossAmount - taxDeducted`
- **Sources**: Manually entered or auto-imported from RAMIS PDFs

### 2. Calculation Logic

#### 🧮 Tax Computation (FR-08, FR-09)
Implemented in `src/lib/taxEngine.ts`.

1.  **Total Income**: Sum of Employment + Business + Investment + Other Income.
    *   *Note*: Investment income includes manually entered records AND derived interest/dividends from Asset balances.
    *   *Rent Relief*: 25% deduction applied automatically to Rent income.
    *   *Exempt Income*: Employment (Schedule 1) and Other Income (Schedule 4) exempt amounts automatically excluded from taxable income.
2.  **Taxable Income**:
    `Total Income - Personal Relief - Solar Relief`
    *   *Personal Relief*: Rs. 1,200,000 (for 2024/2025).
    *   *Solar Relief*: Lower of Investment or Rs. 600,000.
3.  **Tax on Income**: Calculated using progressive tax bands (2024 rates):
    *   First Rs. 500,000 @ 6%
    *   Next Rs. 500,000 @ 12%
    *   ...up to Balance @ 36%
4.  **Tax Credits**: Sum of APIT and WHT from all sources
    *   *APIT (Cage 903)*: From employment income schedules + employment certificates
    *   *WHT (Cage 908)*: From investment income schedules + WHT certificates (interest, dividend, rent, other)
5.  **Tax Payable**:
    `Tax on Income - Tax Credits (APIT + WHT)`

#### ⚠️ Audit Risk / Danger Meter (FR-10)
Detects "Unexplained Wealth" by balancing Inflows vs. Outflows for the current tax year.

**Entity Filtering**: Calculations respect Dashboard entity selection:
- **Family View**: Combines all family members' data
- **Individual View**: Filters to show only selected entity's assets, liabilities, and incomes (including joint ownership proportions)

**Formula**: `Risk Score = Total Outflows - Total Inflows`

*   **Inflows**:
    *   (+) Employment Income (Schedule 1, after exempt income)
    *   (+) Business Income (Schedule 2)
    *   (+) Investment Income (Schedule 3, including stock dividends)
    *   (+) Other Income (Schedule 4, after exempt income)
    *   (+) New Loans taken in current year
    *   (+) Asset Sales (proceeds from disposed assets)
    *   (+) Savings Withdrawals (from bank/cash accounts)
    *   (+) Stock Cash Withdrawals (from broker accounts)
*   **Outflows**:
    *   (+) Tax Deducted (APIT + WHT paid at source)
    *   (+) Asset Purchases (cost of assets acquired in current year)
    *   (+) Property Expenses (renovations/improvements)
    *   (+) Loan Principal Payments
    *   (+) Loan Interest Payments
    *   (+) Savings Deposits (to bank/cash accounts)
    *   (+) Stock Cash Deposits (to broker accounts)
    *   (+) **Derived Living Expenses** = max(0, Inflows - Other Outflows)

**Living Expenses Calculation**:
- System automatically derives living expenses as the balancing figure
- Formula: `Living_Expenses = Total_Inflows - (Tax + Assets + Property + Loan_Principal + Loan_Interest)`
- No need for user estimation - calculated mathematically from actual financial flows

**Visual Breakdown**:
- Single pie chart with 10 categories (5 inflows + 6 outflows)
- Color-coded: Green (inflows), Red/Orange (outflows), Yellow (living expenses)
- Detailed breakdown tables showing amounts and percentages
- Balance calculation box showing derivation of living expenses

**Risk Levels**:
*   🟢 **Safe**: Risk Score ≤ 0 (Inflows cover Outflows)
*   🟡 **Warning**: Risk Score > 0 but ≤ 500,000
*   🔴 **Danger**: Risk Score > 500,000 (High risk of audit)
*   ⚖️ **Balanced**: Risk Score = 0 (Perfect balance - no unexplained wealth or surplus)

#### 💰 Net Worth
Displayed on the Dashboard.

*   **Total Assets**: Sum of Market Values of all active assets.
    *   *Property Valuation*: Uses the latest market value recorded in Property Expenses, or falls back to initial market value.
*   **Total Liabilities**: Sum of Current Balances.
    *   *Balance Calculation*: `Original Amount - Sum(Principal Payments)`
*   **Net Worth**: `Total Assets - Total Liabilities`

## 🔒 Security Architecture

```
User Passphrase
     ↓ PBKDF2 (100,000 iterations)
Encryption Key (AES-256)
     ↓ AES-GCM
Encrypted Data → localStorage (Browser)
```

- Encryption key derived from user passphrase using PBKDF2
- Data encrypted before saving to localStorage (supports larger datasets than cookies)
- No analytics trackers or external API calls
- Passphrase hash stored for validation (not the passphrase itself)
- Backup files (.wglk) are fully encrypted and portable
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

## 🛣️ Development Status

- [x] **Phase 1**: Project setup with React + Vite + Zustand + localStorage ✅
- [x] **Phase 2**: Encryption layer and storage utilities ✅
- [x] **Phase 3**: Core UI components (Danger Meter, Entity Form) ✅
- [x] **Phase 4**: Tax calculation engine ✅
- [x] **Phase 5**: Income schedule forms (Schedules 1-3) ✅
- [x] **Phase 6**: Asset and Liability management UI ✅
- [x] **Phase 7**: Source of Funds wizard ✅
- [x] **Phase 8**: Export functionality (JSON + CSV) ✅
- [x] **Phase 9**: Tax Computation page and Settings ✅
- [x] **Phase 10**: Import backup functionality ✅
- [x] **Phase 11**: Firebase deployment ✅
- [x] **Phase 12**: Tax certificate tracking (APIT/WHT) ✅
- [x] **Phase 13**: AI-powered PDF import (RAMIS, T10, Certificates) ✅
- [x] **Phase 14**: Financial PDF import (Bank statements, Loan payments) ✅
- [x] **Phase 15**: AI Tax Agent Chatbot with legislation integration ✅
  - Build-time PDF extraction using pdfjs-dist (no Gemini API for legislation)
  - Instant JSON loading (524KB pre-extracted legislation)
  - Full Inland Revenue Act No. 24 of 2017 text
- [ ] **Phase 16**: Testing and IRD compliance validation 🚧

**MVP Status**: Ready for Production - Deployed at https://wealthguard-f7c26.web.app

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
