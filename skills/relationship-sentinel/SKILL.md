---
name: relationship-sentinel
description: Detect cross-sell opportunities by analyzing logs/transaction_stream.log and updating company_dossier.json, then generate a banker-ready Sales_Brief.md with a personalized email draft. Use when transaction activity should drive proactive relationship recommendations.
---

# Relationship Sentinel

## Overview

Detect revenue and growth opportunities from transaction activity and propose tailored products.
Append cross-sell signals to the dossier and generate a sales brief.

## Workflow

### 1) Load inputs

- Read `logs/transaction_stream.log`.
- Read `company_dossier.json`.

### 2) Detect patterns

- Pattern A — Liquidity Event:
  - Condition: transaction_amount > 1,000,000 AND source indicates Investment / VC / PE
  - Action: recommend “Liquidity Management / Sweep Account”
- Pattern B — FX Exposure:
  - Condition: transaction currency != USD
  - Action: recommend “FX Forward Contracts”

### 3) Update dossier

- Append to `cross_sell_opportunities` (do not overwrite):
  - `signal`: `LIQUIDITY_EVENT` or `FX_EXPOSURE`
  - `recommended_product`: string
  - `trigger_transaction`: string
  - `confidence`: `HIGH`

### 4) Write Sales_Brief.md

- Sections:
  1) Opportunity Summary (signals + why now)
  2) Recommended Products (benefits)
  3) Suggested Talking Points (tailored)
  4) Personalized Email Draft (consultative, ~150 words, no raw amounts)

### 5) Log summary

- Log signals detected and recommended products.

## Scripts

- `scripts/relationship_sentinel.py`: Parse transaction logs, append opportunities, and write Sales_Brief.md.
- Run from repo root:
  - `python3 skills/relationship-sentinel/scripts/relationship_sentinel.py`
