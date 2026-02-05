# Commercial Lending Autopilot

This project is a client-facing business lending workflow that runs four agent functions in one flow:

1. KYB (entity and ownership extraction)
2. Compliance (sanctions and prohibited-industry checks)
3. Underwriting (financial spreading, EBITDA, DSCR, credit decision)
4. Relationship signals (cross-sell opportunities)

All decisions are consolidated into a shared dossier and output artifacts.

## Project Structure

- `kyb-ui/` - React + Vite frontend and Express backend API
- `skills/` - Agent skill definitions and scripts
- `docs/` - Sample and test input files
- `docs/clients/testing-data/` - Realistic test files (PDF/XLSX)
- `data/` - Base sanctions list used by non-UI scripts

### Runtime output location

The UI server writes generated output here:

- `kyb-ui/data/company_dossier.json`
- `kyb-ui/data/Credit_Memo.md`
- `kyb-ui/data/Sales_Brief.md`

## Supported Upload Formats

### Articles of Incorporation
- `.txt`, `.doc`, `.docx`, `.pdf`

### Financials
- `.txt`, `.csv`, `.xls`, `.xlsx`, `.pdf`

### Bank Statement
- `.log`, `.txt`, `.csv`, `.xls`, `.xlsx`, `.pdf`

## Local Setup

### Prerequisites
- Node.js 20+
- npm 10+

### Install

```bash
cd "/Users/rohitsingh/Documents/New project/kyb-ui"
npm install
```

### Run backend

```bash
cd "/Users/rohitsingh/Documents/New project/kyb-ui"
npm run server
```

### Run frontend (new terminal)

```bash
cd "/Users/rohitsingh/Documents/New project/kyb-ui"
npm run dev
```

Open the Vite URL shown in terminal (usually `http://localhost:5173`).

## How to Test with Current Files

Use these files from the UI:

- Articles: `docs/clients/testing-data/Apex_Logistics_Articles_of_Incorporation.pdf`
- Financials: `docs/clients/testing-data/Apex_Logistics_Financial_Package_fixed.xlsx`
- Bank Statement: `docs/clients/testing-data/Apex_Logistics_Bank_Statement_2026-01.pdf`

Then click **Run Autopilot**.

## What the System Produces

### Dossier updates
- KYB status and key entity fields
- Compliance summary and regulatory flags
- Financial metrics (revenue, opex, depreciation, EBITDA, debt service, DSCR)
- Credit decision with compliance override
- Cross-sell opportunities
- Risk score summary

### Artifacts
- Credit memo (`Credit_Memo.md`)
- Sales brief (`Sales_Brief.md`)

## Decision Logic (High Level)

- DSCR > 1.25 -> `APPROVE`
- DSCR < 1.0 -> `DECLINE`
- Else -> `REVIEW`
- If compliance is critical -> final decision forced to `BLOCKED`

## Important Notes

- If UBO information is missing from articles, KYB can return `REJECTED` with `NO_UBO_OVER_25`.
- `.doc` parsing is best-effort (plain text fallback).
- Sanctions list used by UI backend must exist at:
  - `kyb-ui/data/sanctions_list.txt`

## Troubleshooting

### `ECONNREFUSED` on `/api/autopilot`
Backend is not running. Start `npm run server` in `kyb-ui/`.

### `ERR_MODULE_NOT_FOUND` for a package
Run `npm install` in `kyb-ui/` and restart backend.

### `ENOENT ... sanctions_list.txt`
Create/copy file to `kyb-ui/data/sanctions_list.txt`.

### PDF/XLSX uploads accepted but extraction looks wrong
Check generated intermediate behavior by inspecting:
- `kyb-ui/data/company_dossier.json`
- `kyb-ui/data/Credit_Memo.md`
- `kyb-ui/data/Sales_Brief.md`

## Skills Included

- `skills/kyb-gatekeeper`
- `skills/regulatory-shield`
- `skills/credit-underwriter`
- `skills/relationship-sentinel`
- `skills/commercial-lending-autopilot`

These define modular agent workflows and scripts used by the autopilot.
