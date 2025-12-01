# Software Requirements Specification (SRS)

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

### 3.7 Module: Tax Certificate Tracking

**FR-12: APIT/WHT Certificate Management**
- **Purpose:** Track tax certificates for Advanced Personal Income Tax (APIT) and Withholding Tax (WHT) to claim tax credits.
- **Certificate Types:**
  - **Employment (APIT):** From employers showing APIT deducted (Cage 903)
  - **Interest (WHT):** From banks/financial institutions showing WHT on interest income (Cage 908)
  - **Dividend (WHT):** From companies showing WHT on dividend income (Cage 908)
  - **Rent (WHT):** From tenants showing WHT on rental income (Cage 908)
  - **Other (WHT):** From other sources showing WHT deductions (Cage 908)
- **Required Fields:**
  - Certificate Number (unique identifier)
  - Issue Date
  - Tax Year (supports multi-year tracking)
  - Payer Information (Name, TIN)
  - Financial Details (Gross Amount, Tax Deducted, Net Amount)
  - Verification Status (manual flag for document verification)
  - Description and Notes (optional)
- **Auto-calculation:** System calculates Net Amount = Gross Amount - Tax Deducted
- **Data Sources:**
  - Manual entry through CertificateForm
  - Auto-import from RAMIS PDFs (Gemini AI extraction)
  - Auto-display of employment income from Income Schedule 1

**FR-13: Certificate-Income Linking**
- **Auto-linking:** System automatically links certificates to income entries by:
  - Matching Payer TIN to Income Source TIN (primary method)
  - Matching Payer Name to Income Source Name (fallback method)
- **Manual Linking:** Users can manually select related income entry from dropdown
- **Verification:** 
  - Linked certificates display on income detail view with yellow badge
  - Shows certificate number, payer, amounts, and verification status
  - Provides navigation to certificate details
- **Tax Credit Calculation:**
  - APIT Credits (Cage 903): Sum of employment income APIT + employment certificates
  - WHT Credits (Cage 908): Sum of investment income WHT + WHT certificates by type
  - Breakdown displayed in Income page showing:
    - Employment APIT (with certificate count)
    - Interest WHT (with certificate count)
    - Dividend WHT (with certificate count)
    - Rent WHT (with certificate count)
    - Other WHT (with certificate count)
- **Schedule Integration:**
  - Employment income from Schedule 1 auto-displays in certificate list
  - Visual distinction with blue background and "From Income Schedule" label
  - Auto-verified status for schedule-derived entries
  - Edit/Delete disabled for schedule entries (managed via Income page)

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

### 4.3 AITWHTCertificate Object
```json
{
  "id": "uuid",
  "ownerId": "u1",
  "taxYear": "2024/2025",
  "certificateNo": "CERT-2024-001",
  "issueDate": "2024-12-15",
  "type": "interest", // employment | interest | dividend | rent | other
  "details": {
    "payerName": "Commercial Bank",
    "payerTIN": "987654321",
    "grossAmount": 100000,
    "taxDeducted": 5000, // 5% WHT on interest
    "netAmount": 95000 // Auto-calculated
  },
  "relatedIncomeId": "income-uuid", // Links to Investment Income entry
  "verified": true, // Manual verification flag
  "description": "Interest income WHT certificate",
  "notes": "Verified against original certificate"
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

- **Phase 1:** Setup React + Zustand + IDB. Build the "Entity" and "Asset" forms. ✅
- **Phase 2:** Build the Income Schedules (1, 2, 3) and Relief Logic. ✅
- **Phase 3:** Implement the "Capital Computation" engine (The Danger Meter). ✅
- **Phase 4:** Add Encryption and CSV Export features. ✅
- **Phase 5:** Tax Certificate Tracking (APIT/WHT) with PDF import. ✅
- **Phase 6:** Testing and IRD compliance validation. 🚧

---

## 7. PDF Import Feature (Gemini AI Integration)

### 7.1 Purpose
Enable automatic extraction of tax data from RAMIS (Revenue Administration Management Information System) PDF documents using Google's Gemini AI.

### 7.2 Extraction Capabilities
The system extracts the following data from RAMIS PDFs:

**Section 1: Assets**
- Immovable Properties (Cage 701)
- Motor Vehicles (Cage 711)
- Bank Balances/Term Deposits (Cage 721)
- Shares/Stocks, Cash in Hand, Loans Given, Jewellery/Gold

**Section 2: Liabilities**
- Loan details with lender information, amounts, and security given

**Section 3: Income Schedules**
- Schedule 1: Employment Income (Gross, Deductions, APIT)
- Schedule 2: Business Income (Gross, Expenses, Net Profit)
- Schedule 3: Investment Income (Interest, Dividends, Rent, WHT)

**Section 4: Tax Certificates**
- APIT Certificates from employment income
- WHT Certificates from interest income (one certificate per payer)
- Auto-calculation of net amounts

### 7.3 Certificate Extraction Logic
- **Interest Income Table:** Each row becomes a separate WHT certificate
- **Fields Extracted:** Certificate number, issue date, payer name/TIN, gross amount, tax deducted
- **Auto-linking:** Certificates are linked to corresponding income entries by TIN/payer name matching
- **Validation:** System calculates net amount and validates data consistency

### 7.4 User Workflow
1. User uploads RAMIS PDF through PDFImportWizard
2. Gemini AI processes PDF and extracts structured data
3. Preview shows all extracted data organized by category
4. User reviews and selects items to import (checkboxes)
5. Selected data is imported with auto-linking applied
6. User can verify and edit imported data

---