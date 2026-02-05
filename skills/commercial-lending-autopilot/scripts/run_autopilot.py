#!/usr/bin/env python3
import json
import os
import shutil
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DOSSIER_PATH = ROOT / "company_dossier.json"

AGENTS = {
    "kyb": {
        "script": ROOT / "skills" / "kyb-gatekeeper" / "scripts" / "kyb_extract.py",
    },
    "compliance": {
        "script": ROOT / "skills" / "regulatory-shield" / "scripts" / "regulatory_screen.py",
    },
    "risk": {
        "script": ROOT / "skills" / "credit-underwriter" / "scripts" / "underwrite.py",
    },
    "sales": {
        "script": ROOT / "skills" / "relationship-sentinel" / "scripts" / "relationship_sentinel.py",
    },
}

WORKTREES = {
    "kyb": ROOT / "kyb",
    "compliance": ROOT / "compliance",
    "risk": ROOT / "risk",
    "sales": ROOT / "sales",
}


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def ensure_worktrees():
    for path in WORKTREES.values():
        path.mkdir(parents=True, exist_ok=True)


def run_agent(name: str, script: Path, dossier_path: Path):
    env = os.environ.copy()
    env["DOSSIER_PATH"] = str(dossier_path)
    proc = subprocess.run(
        ["python3", str(script)],
        cwd=str(ROOT),
        env=env,
        capture_output=True,
        text=True,
    )
    return {
        "name": name,
        "returncode": proc.returncode,
        "stdout": proc.stdout.strip(),
        "stderr": proc.stderr.strip(),
        "dossier_path": dossier_path,
    }


def merge_flags(target: dict, source_flags):
    if not isinstance(source_flags, list):
        return
    target_flags = target.get("regulatory_flags")
    if not isinstance(target_flags, list):
        target_flags = []
    for flag in source_flags:
        if flag not in target_flags:
            target_flags.append(flag)
    target["regulatory_flags"] = target_flags


def merge_cross_sell(target: dict, source_list):
    if not isinstance(source_list, list):
        return
    existing = target.get("cross_sell_opportunities")
    if not isinstance(existing, list):
        existing = []
    existing.extend(source_list)
    target["cross_sell_opportunities"] = existing


def merge_kyb(base: dict, kyb: dict):
    for key in ("entity_name", "state", "ubo_list", "kyb_status"):
        if key in kyb:
            base[key] = kyb[key]
    merge_flags(base, kyb.get("regulatory_flags"))


def merge_compliance(base: dict, compliance: dict):
    merge_flags(base, compliance.get("regulatory_flags"))
    if "compliance_summary" in compliance:
        base["compliance_summary"] = compliance["compliance_summary"]
    if compliance.get("credit_decision") == "BLOCKED":
        base["credit_decision"] = "BLOCKED"


def merge_risk(base: dict, risk: dict):
    if "financials" in risk:
        base["financials"] = risk["financials"]
    if "credit_decision" in risk:
        base["credit_decision"] = risk["credit_decision"]


def merge_sales(base: dict, sales: dict):
    merge_cross_sell(base, sales.get("cross_sell_opportunities"))


def enforce_overrides(base: dict):
    flags = base.get("regulatory_flags") or []
    if isinstance(flags, list) and "CRITICAL" in flags:
        base["credit_decision"] = "BLOCKED"


def copy_artifacts():
    credit_src = ROOT / "Credit_Memo.md"
    sales_src = ROOT / "Sales_Brief.md"

    if credit_src.exists():
        shutil.copyfile(credit_src, WORKTREES["risk"] / "Credit_Memo.md")
    if sales_src.exists():
        shutil.copyfile(sales_src, WORKTREES["sales"] / "Sales_Brief.md")


def main():
    ensure_worktrees()

    base_dossier = load_json(DOSSIER_PATH)

    with tempfile.TemporaryDirectory(prefix="autopilot_") as temp_dir:
        temp_dir_path = Path(temp_dir)

        # Run KYB first so compliance has UBOs to screen.
        kyb_path = temp_dir_path / "kyb_dossier.json"
        write_json(kyb_path, base_dossier)
        kyb_result = run_agent("kyb", AGENTS["kyb"]["script"], kyb_path)
        if kyb_result["returncode"] != 0:
            print(f"kyb failed: {kyb_result['stderr'] or kyb_result['stdout']}")
        merge_kyb(base_dossier, load_json(kyb_path))

        # Run remaining agents in parallel.
        dossier_paths = {}
        for name in ("compliance", "risk", "sales"):
            temp_path = temp_dir_path / f"{name}_dossier.json"
            write_json(temp_path, base_dossier)
            dossier_paths[name] = temp_path

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = []
            for name in ("compliance", "risk", "sales"):
                futures.append(
                    executor.submit(run_agent, name, AGENTS[name]["script"], dossier_paths[name])
                )

        results = [future.result() for future in futures]
        for result in results:
            if result["returncode"] != 0:
                print(f"{result['name']} failed: {result['stderr'] or result['stdout']}")

        merged = base_dossier

        merge_compliance(merged, load_json(dossier_paths["compliance"]))
        merge_risk(merged, load_json(dossier_paths["risk"]))
        merge_sales(merged, load_json(dossier_paths["sales"]))

        enforce_overrides(merged)
        write_json(DOSSIER_PATH, merged)

    copy_artifacts()

    kyb_status = merged.get("kyb_status", "UNKNOWN")
    compliance_status = (
        merged.get("compliance_summary", {}).get("status")
        if isinstance(merged.get("compliance_summary"), dict)
        else "UNKNOWN"
    )
    credit_decision = merged.get("credit_decision", "UNKNOWN")
    cross_sell = merged.get("cross_sell_opportunities") or []

    print("Final dossier status:")
    print(f"- KYB status: {kyb_status}")
    print(f"- Compliance status: {compliance_status}")
    print(f"- Credit decision: {credit_decision}")
    print(f"- Cross-sell opportunities: {len(cross_sell)}")
    print("Artifacts:")
    print(f"- Credit Memo: {WORKTREES['risk'] / 'Credit_Memo.md'}")
    print(f"- Sales Brief: {WORKTREES['sales'] / 'Sales_Brief.md'}")


if __name__ == "__main__":
    main()
