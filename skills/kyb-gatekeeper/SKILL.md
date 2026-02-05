---
name: kyb-gatekeeper
description: Extract KYB entity data from unstructured incorporation/formation documents (e.g., articles of incorporation in plain text) and update company_dossier.json with entity_name, state, UBOs, KYB status, and regulatory flags. Use when Codex must parse legal formation documents and populate a shared KYB dossier.
---

# KYB Gatekeeper

## Overview

Transform an unstructured incorporation document into a structured KYB entity profile.
Update only the required fields in company_dossier.json while preserving all other data.

## Workflow

### 1) Load inputs

- Read `docs/articles_inc.txt` (plain text).
- Read `company_dossier.json`.

### 2) Extract core fields

- Locate sections using case-insensitive keyword scans:
  - Entity name: "ENTITY NAME" or "NAME"
  - State: "STATE OF REGISTRATION" or "STATE"
  - Beneficial ownership: "BENEFICIAL OWNERS", "OWNERS", "BENEFICIAL", "UBO"
  - Entity type hints: "LLC", "CORP", "INC", "LTD"
- Extract `entity_name`:
  - Prefer explicit "ENTITY NAME:" line.
  - If missing, infer from the first strong match near entity type hints.
- Extract `state`:
  - Prefer explicit "STATE OF REGISTRATION:" line.

### 3) Build UBO list

- Identify all individuals with ownership_pct > 25%.
- Accept common formats:
  - "John Smith, CEO (60% Ownership)"
  - "Jane Doe - 40%"
  - "Owner: X ... 33.3%"
- For each UBO, capture:
  - `name` (string)
  - `role` (string if present, else null)
  - `ownership_pct` (number)

### 4) Validate and decide KYB status

- If `entity_name` and `state` are found and at least one UBO > 25% exists:
  - Set `kyb_status` = "APPROVED"
- Else:
  - Set `kyb_status` = "REJECTED"
  - Append short reason(s) to `regulatory_flags`:
    - "MISSING_ENTITY_NAME"
    - "MISSING_STATE"
    - "NO_UBO_OVER_25"

### 5) Write outputs

- Update/insert ONLY these fields in `company_dossier.json`:
  - `entity_name`
  - `state`
  - `ubo_list`
  - `kyb_status`
  - `regulatory_flags`
- Preserve all other existing fields.
- Do not invent data. Only extract what is present.
- If a field already exists, update it only if you have higher-confidence extracted data.
- Write the updated JSON back to `company_dossier.json`.

### 6) Log summary

- Print a brief log summary:
  - `entity_name`, `state`
  - number of UBOs found (>25%)
  - `kyb_status` and any flags

## Scripts

- `scripts/kyb_extract.py`: Parse `docs/articles_inc.txt` and update `company_dossier.json`.
- Run from the repo root:
  - `python3 skills/kyb-gatekeeper/scripts/kyb_extract.py`
