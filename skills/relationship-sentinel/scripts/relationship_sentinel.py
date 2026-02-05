#!/usr/bin/env python3
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
LOG_PATH = ROOT / "logs" / "transaction_stream.log"
DOSSIER_PATH = Path(os.environ.get("DOSSIER_PATH", ROOT / "company_dossier.json"))
SALES_BRIEF_PATH = ROOT / "Sales_Brief.md"

LIQUIDITY_KEYWORDS = ["investment", "vc", "venture", "private equity", "pe"]


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def load_lines(path: Path):
    if not path.exists():
        return []
    return path.read_text(encoding="utf-8", errors="replace").splitlines()


def parse_amount(text: str):
    if text is None:
        return None
    cleaned = text.replace(",", "").replace("$", "")
    match = re.search(r"-?\d+(?:\.\d+)?", cleaned)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def parse_transaction(line: str):
    # Expected flexible format: key=value pairs separated by commas
    # Example: amount=1200000, currency=EUR, source=VC Funding, id=TX123
    data = {"raw": line.strip()}
    for part in line.split(","):
        if "=" in part:
            key, value = part.split("=", 1)
            data[key.strip().lower()] = value.strip()
    return data


def detect_signals(transactions):
    signals = []
    for tx in transactions:
        amount = parse_amount(tx.get("amount") or tx.get("transaction_amount"))
        currency = (tx.get("currency") or "").upper()
        source = (tx.get("source") or "").lower()
        trigger = tx.get("id") or tx.get("transaction_id") or tx.get("raw")

        if amount is not None and amount > 1_000_000:
            if any(keyword in source for keyword in LIQUIDITY_KEYWORDS):
                signals.append({
                    "signal": "LIQUIDITY_EVENT",
                    "recommended_product": "Liquidity Management / Sweep Account",
                    "trigger_transaction": trigger,
                    "confidence": "HIGH",
                })

        if currency and currency != "USD":
            signals.append({
                "signal": "FX_EXPOSURE",
                "recommended_product": "FX Forward Contracts",
                "trigger_transaction": trigger,
                "confidence": "HIGH",
            })

    return signals


def append_opportunities(dossier: dict, signals):
    existing = dossier.get("cross_sell_opportunities")
    if not isinstance(existing, list):
        existing = []

    for signal in signals:
        existing.append(signal)

    dossier["cross_sell_opportunities"] = existing


def build_sales_brief(dossier: dict, signals):
    entity = dossier.get("entity_name", "Client")
    industry = dossier.get("industry", "Not specified")

    signal_types = sorted({s["signal"] for s in signals}) if signals else []
    products = sorted({s["recommended_product"] for s in signals}) if signals else []

    opportunity_summary = (
        "Signals detected: " + ", ".join(signal_types) if signal_types else "No signals detected."
    )

    product_lines = "\n".join(
        f"- {product}: improve cash visibility and risk management." for product in products
    ) or "- No product recommendations available."

    talking_points = [
        f"Reference recent transaction activity for {entity} without citing raw amounts.",
        "Highlight how proactive treasury tools can stabilize cash flow.",
        "Offer to review FX exposure and hedging options for cross-border activity.",
    ]

    email_body = f"""Hi {entity} Team,

I wanted to share a few proactive ideas based on your recent transaction activity. We are seeing signals that suggest it may be a good time to tighten liquidity visibility and evaluate FX risk management tools. Our team can help you optimize cash positioning while reducing exposure from cross-currency activity.

If it would be helpful, I can arrange a short working session to review your cash flow cadence and discuss whether a sweep structure and/or forward contracts could add value right now.

Best regards,
Senior Banking Advisor
"""

    return f"""# Sales Brief

## 1) Opportunity Summary
- {opportunity_summary}
- Why it matters now: recent transaction patterns suggest active capital movement and cross-border exposure.

## 2) Recommended Product(s)
{product_lines}

## 3) Suggested Talking Points
- {talking_points[0]}
- {talking_points[1]}
- {talking_points[2]}

## 4) Personalized Email Draft
{email_body}
"""


def main():
    dossier = load_json(DOSSIER_PATH)
    lines = load_lines(LOG_PATH)

    transactions = [parse_transaction(line) for line in lines if line.strip()]
    signals = detect_signals(transactions)

    append_opportunities(dossier, signals)

    DOSSIER_PATH.write_text(json.dumps(dossier, indent=2) + "\n", encoding="utf-8")
    SALES_BRIEF_PATH.write_text(build_sales_brief(dossier, signals), encoding="utf-8")

    products = sorted({s["recommended_product"] for s in signals})
    print("signals_detected:", ", ".join(sorted({s["signal"] for s in signals})) or "NONE")
    print("products:", ", ".join(products) or "NONE")


if __name__ == "__main__":
    main()
