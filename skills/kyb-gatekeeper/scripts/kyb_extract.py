#!/usr/bin/env python3
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ARTICLES_PATH = Path(os.environ.get("KYB_ARTICLES_PATH", ROOT / "docs" / "articles_inc.txt"))
DOSSIER_PATH = Path(
    os.environ.get(
        "DOSSIER_PATH",
        os.environ.get("KYB_DOSSIER_PATH", ROOT / "company_dossier.json"),
    )
)

ENTITY_NAME_RE = re.compile(r"\bENTITY\s+NAME\b\s*[:\-]\s*(.+)", re.IGNORECASE)
STATE_RE = re.compile(r"\bSTATE\s+OF\s+REGISTRATION\b\s*[:\-]\s*(.+)", re.IGNORECASE)
ENTITY_HINT_RE = re.compile(r"\b([A-Z][A-Za-z0-9&.,'\- ]+\b(?:LLC|L\.L\.C\.|CORP|CORPORATION|INC|INC\.|LTD|L\.T\.D\.))\b", re.IGNORECASE)
PCT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def read_articles_text() -> str:
    if os.environ.get("KYB_USE_STDIN") == "1":
        data = sys.stdin.buffer.read()
        if not data:
            return ""
        return data.decode("utf-8", errors="replace")
    return read_text(ARTICLES_PATH)


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def strip_bullets(line: str) -> str:
    return re.sub(r"^[\s\-*\u2022]+", "", line).strip()


def extract_entity_name(text: str):
    for line in text.splitlines():
        m = ENTITY_NAME_RE.search(line)
        if m:
            return m.group(1).strip(), "explicit"
    # fallback: infer from first strong match near entity type hints
    for line in text.splitlines():
        m = ENTITY_HINT_RE.search(line)
        if m:
            return m.group(1).strip(), "inferred"
    return None, None


def extract_state(text: str):
    for line in text.splitlines():
        m = STATE_RE.search(line)
        if m:
            return m.group(1).strip(), "explicit"
    return None, None


def parse_ubo_line(line: str):
    m_pct = PCT_RE.search(line)
    if not m_pct:
        return None
    pct = float(m_pct.group(1))
    if pct <= 25:
        return None

    cleaned = strip_bullets(line)

    # Remove parenthetical that contains ownership percentage
    cleaned = re.sub(r"\([^)]*%[^)]*\)", "", cleaned).strip()

    # Prefer content after labels like "Owner:" or "Beneficial Owner:"
    label_match = re.search(r"\bOWNER\b\s*[:\-]\s*(.+)", cleaned, re.IGNORECASE)
    if label_match:
        cleaned = label_match.group(1).strip()

    name = None
    role = None

    # Split by comma for name/role
    if "," in cleaned:
        parts = [p.strip() for p in cleaned.split(",", 1)]
        name = parts[0]
        role = parts[1] if parts[1] else None
    elif " - " in cleaned:
        parts = [p.strip() for p in cleaned.split(" - ", 1)]
        name = parts[0]
        role = parts[1] if parts[1] else None
    elif " – " in cleaned or " — " in cleaned:
        if " – " in cleaned:
            parts = [p.strip() for p in cleaned.split(" – ", 1)]
        else:
            parts = [p.strip() for p in cleaned.split(" — ", 1)]
        name = parts[0]
        role = parts[1] if parts[1] else None
    else:
        name = cleaned.strip()

    if not name:
        return None

    return {
        "name": name,
        "role": role,
        "ownership_pct": pct,
    }


def build_ubo_list(text: str):
    ubo_list = []
    for line in text.splitlines():
        if not PCT_RE.search(line):
            continue
        ubo = parse_ubo_line(line)
        if ubo:
            ubo_list.append(ubo)
    return ubo_list


def update_field(dossier: dict, key: str, value, confidence: str, existing_confidence_required: bool = False):
    if value is None:
        return
    existing = dossier.get(key)
    if existing is None:
        dossier[key] = value
        return
    if confidence == "explicit":
        dossier[key] = value
        return
    if confidence == "inferred" and not existing_confidence_required:
        return


def main():
    articles_text = read_articles_text()
    dossier = load_json(DOSSIER_PATH)

    entity_name, entity_conf = extract_entity_name(articles_text)
    state, state_conf = extract_state(articles_text)
    ubo_list = build_ubo_list(articles_text)

    update_field(dossier, "entity_name", entity_name, entity_conf)
    update_field(dossier, "state", state, state_conf)
    if ubo_list:
        dossier["ubo_list"] = ubo_list

    # regulatory flags (append only if needed)
    flags = dossier.get("regulatory_flags")
    if not isinstance(flags, list):
        flags = []

    missing_flags = []
    if not entity_name:
        missing_flags.append("MISSING_ENTITY_NAME")
    if not state:
        missing_flags.append("MISSING_STATE")
    if not ubo_list:
        missing_flags.append("NO_UBO_OVER_25")

    if missing_flags:
        dossier["kyb_status"] = "REJECTED"
        for flag in missing_flags:
            if flag not in flags:
                flags.append(flag)
    else:
        dossier["kyb_status"] = "APPROVED"

    dossier["regulatory_flags"] = flags

    DOSSIER_PATH.write_text(json.dumps(dossier, indent=2, sort_keys=False) + "\n", encoding="utf-8")

    # Log summary
    print(f"entity_name: {entity_name or 'N/A'}")
    print(f"state: {state or 'N/A'}")
    print(f"ubos_over_25: {len(ubo_list)}")
    print(f"kyb_status: {dossier.get('kyb_status')}")
    if missing_flags:
        print(f"flags: {', '.join(missing_flags)}")


if __name__ == "__main__":
    main()
