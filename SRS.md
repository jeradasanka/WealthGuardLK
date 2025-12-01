git # Software Requirements Specification (SRS)

**Project Name:** WealthGuard LK  
**Version:** 1.0  
**Tech Stack:** React, Vite, Tailwind/Shadcn, IndexedDB, AES-GCM Encryption

---

## 1. Introduction

### 1.1 Purpose
The primary purpose of this application is to allow Sri Lankan families to track their financial portfolio (Assets, Liabilities, Income) in a way that mathematically proves the source of funds for every asset acquired. It serves as a pre-audit tool to prevent "unexplained wealth" flags before filing the official Asmt_IIT_003_E return.

### 1.2 Scope
- **Target Users:** Individuals and couples filing Personal Income Tax (IIT) in Sri Lanka.
- **Key Capability:** Simulates the IRD "Capital Computation" to detect audit risks.
- **Output:** Generates filled values for IRD Schedules (1-10) and the Statement of Assets & Liabilities.
- **Privacy:** Zero-Knowledge architecture. All data is stored in the browser (IndexedDB) and encrypted. No data is sent to any server.

---

## 2. System Architecture

### 2.1 Component Diagram
- **Frontend (React + Vite):** Handles UI, Validation logic, and Tax Calculations.
- **State Management (Zustand):** Manages real-time updates of the "Danger Meter."
- **Storage Layer (idb-keyval):** Stores the encrypted JSON blob in the user's browser.
- **Security Layer (Web Crypto API):** Handles AES-GCM encryption/decryption using a user-derived passphrase.

### 2.2 User Types
- **Primary Taxpayer (Admin):** Manages the main TIN profile (e.g., John Doe).
- **Secondary Taxpayer (Spouse):** Manages the secondary TIN profile (e.g., Jane Doe) within the same dashboard for consolidated wealth tracking.

---

## 3. Functional Requirements

### 3.1 Module: Tax Entity Management

**FR-01: Profile Creation**
- System must allow creating multiple entities (Husband, Wife).
- **Required Fields:** Name, TIN, Mobile, Email (mapped to Guide Page 30).
- **Logic:** Users must define a "Split Ratio" for Joint Assets (default 50/50).

### 3.2 Module: Income & Schedule Mapper
The system must automatically route income entries to the correct IRD Schedule.

**FR-02: Employment Income (Schedule 1)**
- **Input:** Gross Remuneration, Non-Cash Benefits.
- **Deductions:** APIT (Advance Personal Income Tax).
- **Validation:** APIT is recorded as a Tax Credit (Schedule 9, Cage 903), not an expense.

**FR-03: Business Income (Schedule 2)**
- **Input:** Gross Revenue, Direct Expenses.
- **Net Profit Calculation:** Only the "Gains and Profits" (Cage 203) are pushed to the Taxable Income calculation.

**FR-04: Investment Income (Schedule 3)**
- **Sub-Feature: WHT Handler**
  - User inputs "Gross Interest" and "WHT Deducted."
  - System maps "Gross" to Income (Cage 303) and "WHT" to Tax Credits (Cage 908).
- **Sub-Feature: Rent Logic**
  - If Type = "Rent", system automatically applies 25% Relief (Cage 316) before adding to Assessable Income.

### 3.3 Module: Asset & Liability Tracking (The Audit Shield)
This module maps directly to the "Statement of Assets and Liabilities".

**FR-05: Asset Registry (Cages 701-721)**
- **Immovable Property (Cage 701):** Fields for Address, Deed No, Cost, Market Value.
- **Motor Vehicles (Cage 711):** Fields for Reg No, Brand, Cost. Auto-depreciation logic for "Market Value" estimation.
- **Bank/Financial (Cage 721):** Must link specific bank accounts to Schedule 3 Income entries (Interest check).

**FR-06: Liability Management (Cage 781)**
- **Fields:** Lender Name, Original Amount, Current Balance, Security Given.
- **Logic:** Reducing a liability (Principal Payment) is treated as "Cash Outflow" in the Capital Computation.

### 3.4 Module: The "Source of Funds" Linker (Critical)

**FR-07: Asset Acquisition Wizard**
- **Trigger:** When a user adds an Asset with Date Acquired in the current tax year.
- **Requirement:** System must prompt: "Source of Funds?"
  - **Option A:** Current Year Income (Salary/Business).
  - **Option B:** Liquidation of Asset (Select from Dropdown of disposed assets).
  - **Option C:** New Liability (Select from Loan module).
  - **Option D:** Gift/Inheritance (Text description).
- **Alert:** If Source < Cost, flag as "Unexplained Wealth."

### 3.5 Module: Tax Calculation & Reliefs

**FR-08: Relief Application (Annexure 1)**
- **Personal Relief:** Auto-deduct Rs. 1,200,000 for Resident Individuals.
- **Solar Relief:** Deduct min(Cost_of_Solar, 600,000) from Assessable Income.

**FR-09: Tax Computation (Schedule 8)**
- Apply Progressive Tax Rates (6%, 12%, 18%... 36%) on the balance Taxable Income.
- Apply Special Rates (e.g., 10% on Capital Gains from Investment Assets).

### 3.6 Module: Reporting & Export

**FR-10: The "Danger Meter" (Audit Risk Gauge)**
- **Formula:** `Risk_Score = (Asset_Growth + Est_Living_Expenses) - (Declared_Income + Loans)`
- **Visual:**
  - **Green:** If Risk_Score ≈ 0 (Balanced).
  - **Red:** If Risk_Score > 0 (You spent more than you earned).

**FR-11: Data Export**
- **JSON Backup:** Full state dump, encrypted with AES-GCM.
- **IRD Schedule 7 CSV:** Generates `[TIN]_IIT_WHTSCHEDULE_2425_ORIGINAL_V1.csv` formatted exactly as per IRD specs for WHT certificate upload.

### 3.7 Module: AI-Powered PDF Import

**FR-12: RAMIS PDF Import**
- Extract income schedules, assets, liabilities, and certificates from IRD RAMIS PDFs
- Auto-detect entity by name matching
- Auto-detect tax year from document dates
- Preview and selective import with entity/year override

**FR-13: Income Schedule PDF Import**
- Import T10 forms for Schedules 1, 2, and 3
- Extract employment income (gross, allowances, APIT)
- Extract business income (gross revenue, expenses, net profit)
- Extract investment income (interest, dividends, rent, WHT)
- Auto-link to entities by name (T10 forms typically don't include employer TIN)

**FR-14: Financial PDF Import**
- **Bank Statement Import:**
  - Extract opening balance, closing balance, interest earned
  - Extract account details (number, holder name, bank name, account type)
  - Detect statement period and auto-assign tax year
  - Support for multiple account types (savings, checking, term deposits)
  - Handle deposits, withdrawals, and balance calculations
- **Loan Payment Import:**
  - Extract payment date, principal paid, interest paid
  - Calculate total payment and balance after payment
  - Extract lender information and loan account numbers
  - Support for payment receipts, amortization schedules, and loan statements
  - Auto-detect tax year from payment date
- **Universal Features:**
  - OCR support for scanned documents
  - Model selection (Gemini 2.0 Flash, 1.5 Pro, 1.5 Flash)
  - Entity filter to show only specific taxpayer's assets/liabilities
  - Tax year override for each record before import
  - Preview with checkboxes for selective import
  - 3-step wizard (upload → preview → complete)

---

## 4. Data Dictionary (JSON Schema)

### 4.1 Asset Object
```json
{
  "id": "uuid",
  "ownerId": "u1",
  "cageCategory": "711", // Maps to Vehicle
  "meta": {
    "regNo": "ABC-1234",
    "description": "Toyota Prius",
    "dateAcquired": "2024-02-15"
  },
  "financials": {
    "cost": 8500000,
    "marketValue": 8200000,
    "sourceOfFunds": {
      "type": "loan",
      "loanId": "l1",
      "amount": 5000000,
      "savings": 3500000
    }
  }
}
```

### 4.2 Income Object
```json
{
  "id": "uuid",
  "ownerId": "u1",
  "schedule": "1", // Employment
  "details": {
    "employerTIN": "123456789",
    "grossPay": 4500000,
    "apitDeducted": 150000, // Linked to Tax Credit
    "exemptIncome": 0
  }
}
```

### 4.3 FinancialAssetBalance Object
```json
{
  "id": "uuid",
  "taxYear": "2024",
  "closingBalance": 2500000,
  "interestEarned": 125000,
  "notes": "Imported from bank_statement_2024.pdf - Commercial Bank Savings Account"
}
```

### 4.4 LiabilityPayment Object
```json
{
  "id": "uuid",
  "taxYear": "2024",
  "date": "2024-12-01",
  "principalPaid": 500000,
  "interestPaid": 85000,
  "notes": "Imported from loan_statement_2024.pdf - Housing Loan EMI"
}
```

---

## 5. Non-Functional Requirements

- **Security:** Encryption Key is derived from user password using PBKDF2. Data is encrypted before saving to IndexedDB.
- **Privacy:** No analytics trackers (Google Analytics, etc.). No external API calls except explicitly triggered backups (if cloud feature added later).
- **Reliability:** App must work 100% offline.
- **Compliance:** UI labels must match the exact wording of the IRD Guide to reduce user confusion.

---

## 6. Development Roadmap (MVP)

- **Phase 1:** Setup React + Zustand + IDB. Build the "Entity" and "Asset" forms.
- **Phase 2:** Build the Income Schedules (1, 2, 3) and Relief Logic.
- **Phase 3:** Implement the "Capital Computation" engine (The Danger Meter).
- **Phase 4:** Add Encryption and CSV Export features.
