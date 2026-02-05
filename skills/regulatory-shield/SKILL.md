---
name: regulatory-shield
description: Perform regulatory scrubbing for KYB by screening UBOs against sanctions lists and checking prohibited industries, then update company_dossier.json with flags, compliance_summary, and credit decision. Use when credit underwriting requires sanctions and prohibited-industry checks based on a dossier and sanctions_list.txt.
---

# Regulatory Shield

## Overview

Screen a business entity for sanctions exposure and prohibited-industry risk.
Update only compliance-related fields in company_dossier.json without altering other data.

## Workflow

### 1) Load inputs

- Read `company_dossier.json`.
- Read `data/sanctions_list.txt` (plain text list; one name per line).
- Optional: read business type/industry from dossier.

### 2) Sanctions screening

- Load `ubo_list` from the dossier.
- For each UBO, perform case-insensitive matching against the sanctions list.
- Include fuzzy/partial matches (e.g., last name match + first initial).
- If a match is found:
  - Append `SANCTIONS_HIT` to `regulatory_flags`.
  - Record `ubo_name` and `matched_name` in `compliance_summary`.
  - Set `credit_decision` = `BLOCKED`.

### 3) Prohibited industry check

- Extract `business_type` or `industry` from the dossier.
- Compare against prohibited industries (case-insensitive, keyword-based):
  - Cannabis
  - Weapons / Firearms
  - Gambling
  - Adult Entertainment
  - Sanctioned Jurisdictions
- If a match is found:
  - Append `PROHIBITED_INDUSTRY` to `regulatory_flags`.
  - Set `credit_decision` = `BLOCKED`.

### 4) Apply branching rules

- If any critical issue is found:
  - `regulatory_flags` must include `CRITICAL`.
  - `credit_decision` = `BLOCKED`.
- Else: do NOT modify `credit_decision`.

### 5) Write outputs

- Update/insert ONLY these fields in `company_dossier.json`:
  - `regulatory_flags` (append only)
  - `compliance_summary`
  - `credit_decision` (only if critical)
- Preserve all other fields.
- Do NOT hallucinate sanctions hits.
- Do NOT clear or downgrade existing flags.

### 6) Log summary

- Log:
  - UBOs screened
  - Industry checked
  - Compliance outcome

## Scripts

- `scripts/regulatory_screen.py`: Run sanctions and prohibited-industry checks and update the dossier.
- Run from repo root:
  - `python3 skills/regulatory-shield/scripts/regulatory_screen.py`
