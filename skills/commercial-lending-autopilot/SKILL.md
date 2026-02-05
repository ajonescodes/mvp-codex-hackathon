---
name: commercial-lending-autopilot
description: Orchestrate a commercial lending workflow by coordinating KYB, compliance, underwriting, and relationship agents in parallel using company_dossier.json as the shared state. Use when a single intake must produce KYB status, compliance screening, credit decisioning, and cross-sell outputs.
---

# Commercial Lending Autopilot

## Overview

Coordinate four autonomous agents to process a single client in parallel.
Ensure compliance outcomes override credit outcomes and summarize final dossier status.

## Inputs

- `docs/articles_inc.txt` (entity data)
- `docs/financials.txt` (income statement)
- `data/sanctions_list.txt` (compliance data)
- `logs/transaction_stream.log` (transaction activity)
- Shared state: `company_dossier.json`

## Agent Worktrees

- `/kyb` → Agent 1 (KYB Gatekeeper)
- `/compliance` → Agent 2 (Regulatory Shield)
- `/risk` → Agent 3 (Credit Underwriter)
- `/sales` → Agent 4 (Relationship Sentinel)

## Parallel Execution Plan

### Agent 1 — KYB Gatekeeper (/kyb)

- Parse `docs/articles_inc.txt`.
- Extract `entity_name`, `state`, and UBOs (>25% ownership).
- Update `company_dossier.json`.

### Agent 2 — Regulatory Shield (/compliance)

- Read UBOs from `company_dossier.json`.
- Screen against `data/sanctions_list.txt`.
- Check prohibited industry risk.
- If any sanctions hit: append `CRITICAL` to `regulatory_flags` and set `credit_decision = BLOCKED`.

### Agent 3 — Credit Underwriter (/risk)

- Parse `docs/financials.txt`.
- Calculate EBITDA and DSCR.
- Generate `Credit_Memo.md`.
- Set `credit_decision` based on DSCR.
- **Hard constraint:** If `regulatory_flags` contains `CRITICAL`, override to `BLOCKED`.

### Agent 4 — Relationship Sentinel (/sales)

- Scan `logs/transaction_stream.log`.
- Detect liquidity and FX exposure signals.
- Generate `Sales_Brief.md`.
- Append opportunities to `company_dossier.json`.

## Global Constraints

- Agents must not overwrite each other’s fields.
- `company_dossier.json` is the single source of truth.
- Compliance outcomes override credit outcomes.

## Final Output

When all agents complete, summarize:
- KYB status
- Compliance status
- Credit decision
- Cross-sell opportunities

Report artifacts:
- Credit Memo → `/risk/Credit_Memo.md`
- Sales Brief → `/sales/Sales_Brief.md`

## Scripts

- `scripts/run_autopilot.py`: Run all four agents in parallel, merge dossier updates, and report final status.
- Run from repo root:
  - `python3 skills/commercial-lending-autopilot/scripts/run_autopilot.py`
