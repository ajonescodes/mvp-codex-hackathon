#!/usr/bin/env python3
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FINANCIALS_PATH = ROOT / "docs" / "financials.txt"
DOSSIER_PATH = Path(os.environ.get("DOSSIER_PATH", ROOT / "company_dossier.json"))
MEMO_PATH = ROOT / "Credit_Memo.md"

FIELDS = {
    "gross_revenue": ["gross revenue", "revenue", "total revenue"],
    "operating_expenses": ["operating expenses", "opex", "operating expense"],
    "depreciation": ["depreciation"],
    "annual_debt_service": ["total annual debt service", "annual debt service", "debt service"],
    "proposed_loan_amount": ["proposed loan amount", "loan amount"],
}


def load_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def parse_number(value: str):
    if value is None:
        return None
    cleaned = value.replace(",", "")
    cleaned = cleaned.replace("$", "")
    cleaned = cleaned.replace(" ", "")
    match = re.search(r"-?\d+(?:\.\d+)?", cleaned)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def extract_field(text: str, labels):
    for line in text.splitlines():
        lowered = line.lower()
        for label in labels:
            if label in lowered:
                parts = re.split(r"[:\-]", line, maxsplit=1)
                if len(parts) > 1:
                    return parse_number(parts[1])
                return parse_number(line)
    return None


def format_money(value):
    if value is None:
        return "Not provided"
    return f"${value:,.0f}" if value == int(value) else f"${value:,.2f}"


def format_ratio(value):
    if value is None:
        return "Not provided"
    return f"{value:.2f}x"


def main():
    financials_text = load_text(FINANCIALS_PATH)
    dossier = load_json(DOSSIER_PATH)

    parsed = {}
    for key, labels in FIELDS.items():
        parsed[key] = extract_field(financials_text, labels)

    gross = parsed.get("gross_revenue")
    opex = parsed.get("operating_expenses")
    depreciation = parsed.get("depreciation")
    debt_service = parsed.get("annual_debt_service")

    ebitda = None
    if gross is not None and opex is not None and depreciation is not None:
        ebitda = (gross - opex) + depreciation

    dscr = None
    if ebitda is not None and debt_service not in (None, 0):
        dscr = ebitda / debt_service

    decision = None
    if dscr is not None:
        if dscr > 1.25:
            decision = "APPROVE"
        elif dscr < 1.0:
            decision = "DECLINE"
        else:
            decision = "REVIEW"
    else:
        decision = "REVIEW"

    regulatory_flags = dossier.get("regulatory_flags") or []
    if isinstance(regulatory_flags, list) and "CRITICAL" in regulatory_flags:
        decision = "BLOCKED"

    financials_obj = dossier.get("financials")
    if not isinstance(financials_obj, dict):
        financials_obj = {}

    if gross is not None:
        financials_obj["gross_revenue"] = gross
    if opex is not None:
        financials_obj["operating_expenses"] = opex
    if depreciation is not None:
        financials_obj["depreciation"] = depreciation
    if ebitda is not None:
        financials_obj["ebitda"] = ebitda
    if debt_service is not None:
        financials_obj["annual_debt_service"] = debt_service
    if dscr is not None:
        financials_obj["dscr"] = dscr

    dossier["financials"] = financials_obj
    dossier["credit_decision"] = decision

    DOSSIER_PATH.write_text(json.dumps(dossier, indent=2) + "\n", encoding="utf-8")

    business_name = dossier.get("entity_name", "Business")
    industry = dossier.get("industry", "Not specified")

    memo = f"""# Credit Memo

## 1) Executive Summary
{business_name} is requesting commercial credit. Based on the provided financials, the preliminary decision is **{decision}**.

## 2) Business Overview
- Entity: {business_name}
- Industry: {industry}

## 3) Financial Analysis
- Gross Revenue: {format_money(gross)}
- Operating Expenses: {format_money(opex)}
- Depreciation (add-back): {format_money(depreciation)}
- EBITDA: {format_money(ebitda)}
- Annual Debt Service: {format_money(debt_service)}
- DSCR: {format_ratio(dscr)}

Depreciation is treated as a non-cash expense and added back to operating earnings when calculating EBITDA.

## 4) Strengths
- Revenue scale supports ongoing operations (subject to verification).
- Documented financial metrics available for spreading.

## 5) Risks / Weaknesses
- Financial inputs are limited to the provided document; additional statements may be required.
- Debt service coverage should be monitored against policy thresholds.

## 6) Credit Recommendation
**Decision:** {decision}

**Suggested Covenant:** Maintain DSCR > 1.25x.
"""

    MEMO_PATH.write_text(memo, encoding="utf-8")

    print(f"EBITDA: {format_money(ebitda)}")
    print(f"DSCR: {format_ratio(dscr)}")
    print(f"Decision: {decision}")


if __name__ == "__main__":
    main()
