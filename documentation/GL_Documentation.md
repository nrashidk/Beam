# General Ledger — Documentation

## Overview

The General Ledger (GL) is the central financial record-keeping system in InvoLinks. It is structured around three interconnected views accessible from the **General Ledger** page:

1. **Chart of Accounts** — The complete list of all financial accounts used by the company
2. **Journal Entries** — The detailed double-entry bookkeeping transactions
3. **Trial Balance** — The summarised debit/credit totals per account for a given period

---

## 1. Chart of Accounts

### What it is
The Chart of Accounts (CoA) is a structured list of all ledger accounts maintained by the company. Each account is identified by a unique code and belongs to one of five standard accounting types.

### Account Types

| Type | Description | Examples |
|------|-------------|---------|
| **ASSET** | Resources owned by the company | Cash, Accounts Receivable, Inventory |
| **LIABILITY** | Obligations owed to others | VAT Payable, Accounts Payable, Loans |
| **EQUITY** | Owner's stake in the business | Share Capital, Retained Earnings |
| **REVENUE** | Income earned | Sales Revenue, Service Income |
| **EXPENSE** | Costs incurred | Cost of Goods Sold, Salaries, Rent |

### Account Record Fields

| Field | Description |
|-------|-------------|
| `account_code` | Unique alphanumeric code (e.g., `1100`, `AR-001`) |
| `account_name` | English name of the account |
| `account_name_ar` | Arabic name (bilingual support for UAE FTA compliance) |
| `account_type` | One of: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE |
| `balance` | Current running balance on the account |
| `is_active` | Whether the account is currently in use |

### Where the data comes from
- Accounts are created and managed by the company's finance team within InvoLinks.
- The system pre-seeds a default chart of accounts on company setup.
- Accounts are referenced by Journal Entries — every debit or credit line must point to a valid account code.
- The API endpoint `GET /accounts` returns the full chart for the authenticated company.

---

## 2. Journal Entries

### What it is
Journal Entries are the individual accounting transactions recorded using double-entry bookkeeping. Every financial event (invoice issued, payment received, expense recorded) results in one or more journal entries being created.

### Double-Entry Principle
Each journal entry must balance: **Total Debits = Total Credits**. A single journal entry contains two or more lines — each line affects one account either as a debit or a credit.

**Example — Tax Invoice issued for AED 1,050 (AED 1,000 + 5% VAT):**

| Account | Debit (AED) | Credit (AED) |
|---------|-------------|--------------|
| Accounts Receivable (ASSET) | 1,050.00 | — |
| Sales Revenue (REVENUE) | — | 1,000.00 |
| VAT Payable (LIABILITY) | — | 50.00 |

### Journal Entry Fields

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for the entry |
| `entry_date` | Date the entry was posted |
| `reference` | Reference number (e.g., invoice number) |
| `description` | Narrative description of the transaction |
| `lines` | Array of debit/credit lines (see below) |

**Line Fields:**

| Field | Description |
|-------|-------------|
| `account_code` | The account being debited or credited |
| `account_name` | Display name of the account |
| `debit_amount` | Amount debited to this account (0 if credit line) |
| `credit_amount` | Amount credited to this account (0 if debit line) |

### Where the data comes from
Journal entries in InvoLinks are **automatically generated** from:

- **Invoices** — When a Tax Invoice (type 380) or Commercial Invoice (type 480) is issued, the system creates a journal entry debiting Accounts Receivable and crediting Revenue and VAT Payable.
- **Credit Notes** — When a Credit Note (type 381 or 81) is issued, a reversing entry is created to reduce AR and revenue.
- **Payments received** — When an invoice is marked as paid, a journal entry moves value from AR to Cash/Bank.
- **Expenses** — Each expense logged in the Expense Tracker generates a journal entry debiting the relevant expense account and crediting either Cash or Accounts Payable.
- **Manual entries** — Finance users with appropriate roles may create manual journal entries directly.

The API endpoint `GET /journal-entries` accepts optional filters for date range and returns paginated entries. `GET /journal-entries/{id}` retrieves a single entry with all its lines.

---

## 3. Trial Balance

### What it is
The Trial Balance is a summary report that lists every account with its total debits and total credits for a selected period. It is used to verify that the ledger is mathematically correct (debits equal credits) before producing financial statements.

### Trial Balance Fields (per account)

| Field | Description |
|-------|-------------|
| `account_code` | Account identifier |
| `account_name` | Account display name |
| `account_type` | ASSET / LIABILITY / EQUITY / REVENUE / EXPENSE |
| `total_debit` | Sum of all debit movements in the period |
| `total_credit` | Sum of all credit movements in the period |
| `balance` | Net balance (debit − credit or credit − debit depending on account type) |

### Balanced vs. Out of Balance
- If **Total Debits = Total Credits** across all accounts, the trial balance is balanced — no data entry errors.
- If they differ, the ledger is **out of balance**, indicating a missing or erroneous journal entry.

### Where the data comes from
The Trial Balance is computed in real time from all journal entries posted in the selected date range. The API endpoint `GET /gl-summary` accepts `from_date` and `to_date` parameters, aggregates all journal entry lines in that window, and returns per-account totals.

Exports are available as:
- **XLSX** — Spreadsheet format via `GET /reports/trial-balance/export?format=xlsx`
- **PDF** — Print-ready format via `GET /reports/trial-balance/export?format=pdf`

---

## Data Flow Diagram

```
Invoice Created / Payment Received / Expense Logged
           │
           ▼
   Automatic Journal Entry Generated
   ┌─────────────────────────────────────────┐
   │  Entry Date │ Reference │ Description   │
   │  Lines: Account Code → Debit / Credit   │
   └─────────────────────────────────────────┘
           │
           ▼
   Chart of Accounts (Running Balances Updated)
           │
           ▼
   Trial Balance (Aggregated View for any Date Range)
           │
           ▼
   Financial Statements (P&L, Balance Sheet)
```

---

## Role Access

| Feature | COMPANY_ADMIN | BUSINESS_ADMIN | FINANCE_USER | Other Roles |
|---------|:---:|:---:|:---:|:---:|
| View Chart of Accounts | ✅ | ✅ | ✅ | ❌ |
| Create / Edit Accounts | ✅ | ✅ | ❌ | ❌ |
| View Journal Entries | ✅ | ✅ | ✅ | ❌ |
| Create Manual Entries | ✅ | ✅ | ✅ | ❌ |
| View Trial Balance | ✅ | ✅ | ✅ | ❌ |
| Export Reports | ✅ | ✅ | ✅ | ❌ |

---

## FTA Compliance Notes

- All journal entries are time-stamped and **immutable** once posted. They cannot be deleted — only reversed with a counter-entry. This satisfies UAE FTA audit trail requirements.
- The Chart of Accounts includes **Arabic account names** (`account_name_ar`) to support bilingual reporting as required for tax submissions.
- VAT Payable (Output Tax) and VAT Recoverable (Input Tax) are tracked as dedicated accounts, making VAT Return preparation automatic.
- All GL data is included in the **FTA Audit File** (Annex B — General Ledger) exported from the FTA Audit page.

---

*Last updated: March 2026 | InvoLinks Tax Accounting Software*
