---
name: credit-underwriter
description: Perform commercial credit underwriting by parsing docs/financials.txt, calculating EBITDA and DSCR, updating company_dossier.json, and generating a Credit_Memo.md. Use when spreading financials and issuing an approve/decline/review decision for a lending request.
---

# Credit Underwriter

## Overview

Analyze financial statements for a lending request and produce a credit decision.
Write a concise underwriting memo while preserving all other dossier fields.

## Workflow

### 1) Load inputs

- Read `docs/financials.txt`.
- Read `company_dossier.json`.

### 2) Parse financials

- Extract values explicitly present in the text:
  - Gross Revenue
  - Operating Expenses
  - Depreciation (non-cash)
  - Total Annual Debt Service
  - Proposed Loan Amount (optional)

### 3) Calculate key metrics

- Compute EBITDA:
  - EBITDA = (Gross Revenue - Operating Expenses) + Depreciation
- Compute DSCR:
  - DSCR = EBITDA / Annual Debt Service

### 4) Decisioning

- If DSCR > 1.25 → `credit_decision` = `APPROVE`
- If DSCR < 1.0 → `credit_decision` = `DECLINE`
- Else → `credit_decision` = `REVIEW`

### 5) Update dossier

- Update the `financials` object with parsed and calculated values:
  - `gross_revenue`
  - `operating_expenses`
  - `depreciation`
  - `ebitda`
  - `annual_debt_service`
  - `dscr`
- Update `credit_decision` based on DSCR.
- Preserve all other fields.

### 6) Write Credit_Memo.md

- Structure:
  1) Executive Summary
  2) Business Overview
  3) Financial Analysis (Revenue, EBITDA, DSCR, Depreciation add-back)
  4) Strengths
  5) Risks / Weaknesses
  6) Credit Recommendation (decision + covenant)

### 7) Log summary

- Log EBITDA, DSCR, and final decision.

## Scripts

- `scripts/underwrite.py`: Parse financials, compute metrics, update dossier, and write Credit_Memo.md.
- Run from repo root:
  - `python3 skills/credit-underwriter/scripts/underwrite.py`
