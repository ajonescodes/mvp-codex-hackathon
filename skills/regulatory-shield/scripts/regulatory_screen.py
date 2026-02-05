#!/usr/bin/env python3
import json
import re
from pathlib import Path

import os

ROOT = Path(__file__).resolve().parents[3]
DOSSIER_PATH = Path(os.environ.get("DOSSIER_PATH", ROOT / "company_dossier.json"))
SANCTIONS_PATH = ROOT / "data" / "sanctions_list.txt"

PROHIBITED_INDUSTRIES = {
    "cannabis": ["cannabis", "marijuana", "thc", "weed"],
    "weapons_firearms": ["weapon", "weapons", "firearm", "firearms", "ammo", "ammunition"],
    "gambling": ["gambling", "casino", "sportsbook", "betting"],
    "adult_entertainment": ["adult", "porn", "pornography", "sex", "escort"],
    "sanctioned_jurisdictions": ["sanctioned", "jurisdiction"],
}


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_name(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def split_name(value: str):
    parts = normalize_name(value).split()
    if not parts:
        return "", ""
    first = parts[0]
    last = parts[-1]
    return first, last


def sanctions_match(ubo_name: str, sanctions_name: str) -> bool:
    ubo_norm = normalize_name(ubo_name)
    sanc_norm = normalize_name(sanctions_name)

    if not ubo_norm or not sanc_norm:
        return False

    if ubo_norm == sanc_norm:
        return True

    if ubo_norm in sanc_norm or sanc_norm in ubo_norm:
        return True

    ubo_first, ubo_last = split_name(ubo_name)
    sanc_first, sanc_last = split_name(sanctions_name)

    if ubo_last and sanc_last and ubo_last == sanc_last:
        if ubo_first and sanc_first and ubo_first[0] == sanc_first[0]:
            return True

    return False


def load_sanctions(path: Path):
    if not path.exists():
        return []
    entries = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        value = line.strip()
        if not value or value.startswith("#"):
            continue
        entries.append(value)
    return entries


def match_prohibited_industry(business_type: str):
    if not business_type:
        return None
    text = business_type.lower()
    for key, terms in PROHIBITED_INDUSTRIES.items():
        if any(term in text for term in terms):
            return key
    return None


def main():
    dossier = load_json(DOSSIER_PATH)
    sanctions = load_sanctions(SANCTIONS_PATH)
    ubo_list = dossier.get("ubo_list") or []

    regulatory_flags = dossier.get("regulatory_flags")
    if not isinstance(regulatory_flags, list):
        regulatory_flags = []

    compliance_summary = {
        "sanctions_checked": True,
        "prohibited_industry_checked": True,
        "issues_found": [],
        "status": "CLEAR",
    }

    sanctions_hits = []
    for ubo in ubo_list:
        ubo_name = ubo.get("name") if isinstance(ubo, dict) else None
        if not ubo_name:
            continue
        for sanc_name in sanctions:
            if sanctions_match(ubo_name, sanc_name):
                sanctions_hits.append({"ubo_name": ubo_name, "matched_name": sanc_name})
                break

    critical_found = False

    if sanctions_hits:
        if "SANCTIONS_HIT" not in regulatory_flags:
            regulatory_flags.append("SANCTIONS_HIT")
        compliance_summary["issues_found"].append({
            "type": "SANCTIONS_HIT",
            "matches": sanctions_hits,
        })
        critical_found = True

    business_type = dossier.get("business_type") or dossier.get("industry") or ""
    prohibited_match = match_prohibited_industry(business_type)
    if prohibited_match:
        if "PROHIBITED_INDUSTRY" not in regulatory_flags:
            regulatory_flags.append("PROHIBITED_INDUSTRY")
        compliance_summary["issues_found"].append({
            "type": "PROHIBITED_INDUSTRY",
            "match": prohibited_match,
            "value": business_type,
        })
        critical_found = True

    if critical_found:
        if "CRITICAL" not in regulatory_flags:
            regulatory_flags.append("CRITICAL")
        dossier["credit_decision"] = "BLOCKED"
        compliance_summary["status"] = "CRITICAL"

    dossier["regulatory_flags"] = regulatory_flags
    dossier["compliance_summary"] = compliance_summary

    DOSSIER_PATH.write_text(json.dumps(dossier, indent=2) + "\n", encoding="utf-8")

    print(f"ubos_screened: {len(ubo_list)}")
    print(f"industry_checked: {bool(business_type)}")
    print(f"compliance_status: {compliance_summary['status']}")


if __name__ == "__main__":
    main()
