import express from "express";
import multer from "multer";
import { promises as fs } from "node:fs";
import path from "node:path";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const ROOT = path.resolve(process.cwd(), "..");
const DOSSIER_PATH = path.join(ROOT, "company_dossier.json");

const ENTITY_NAME_RE = /\bENTITY\s+NAME\b\s*[:\-]\s*(.+)/i;
const STATE_RE = /\bSTATE\s+OF\s+REGISTRATION\b\s*[:\-]\s*(.+)/i;
const ENTITY_HINT_RE =
  /\b([A-Z][A-Za-z0-9&.,'\- ]+\b(?:LLC|L\.L\.C\.|CORP|CORPORATION|INC|INC\.|LTD|L\.T\.D\.))\b/i;
const PCT_RE = /(\d+(?:\.\d+)?)\s*%/;

const stripBullets = (line) => line.replace(/^[\s\-*\u2022]+/, "").trim();

const extractEntityName = (text) => {
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(ENTITY_NAME_RE);
    if (match) return { value: match[1].trim(), confidence: "explicit" };
  }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(ENTITY_HINT_RE);
    if (match) return { value: match[1].trim(), confidence: "inferred" };
  }
  return { value: null, confidence: null };
};

const extractState = (text) => {
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(STATE_RE);
    if (match) return { value: match[1].trim(), confidence: "explicit" };
  }
  return { value: null, confidence: null };
};

const parseUboLine = (line) => {
  const pctMatch = line.match(PCT_RE);
  if (!pctMatch) return null;
  const pct = Number(pctMatch[1]);
  if (Number.isNaN(pct) || pct <= 25) return null;

  let cleaned = stripBullets(line);
  cleaned = cleaned.replace(/\([^)]*%[^)]*\)/, "").trim();

  const ownerLabel = cleaned.match(/\bOWNER\b\s*[:\-]\s*(.+)/i);
  if (ownerLabel) cleaned = ownerLabel[1].trim();

  let name = null;
  let role = null;

  if (cleaned.includes(",")) {
    const [n, r] = cleaned.split(",", 2).map((part) => part.trim());
    name = n;
    role = r || null;
  } else if (cleaned.includes(" - ")) {
    const [n, r] = cleaned.split(" - ", 2).map((part) => part.trim());
    name = n;
    role = r || null;
  } else if (cleaned.includes(" -- ")) {
    const [n, r] = cleaned.split(" -- ", 2).map((part) => part.trim());
    name = n;
    role = r || null;
  } else {
    name = cleaned.trim();
  }

  if (!name) return null;
  return { name, role, ownership_pct: pct };
};

const buildUboList = (text) => {
  const ubos = [];
  for (const line of text.split(/\r?\n/)) {
    if (!PCT_RE.test(line)) continue;
    const ubo = parseUboLine(line);
    if (ubo) ubos.push(ubo);
  }
  return ubos;
};

const updateField = (dossier, key, value, confidence) => {
  if (value == null) return;
  const existing = dossier[key];
  if (existing == null) {
    dossier[key] = value;
    return;
  }
  if (confidence === "explicit") dossier[key] = value;
};

app.post("/api/kyb", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing file upload" });
    }

    const articlesText = req.file.buffer.toString("utf-8");
    const dossierRaw = await fs.readFile(DOSSIER_PATH, "utf-8");
    const dossier = dossierRaw.trim() ? JSON.parse(dossierRaw) : {};

    const entityName = extractEntityName(articlesText);
    const state = extractState(articlesText);
    const uboList = buildUboList(articlesText);

    updateField(dossier, "entity_name", entityName.value, entityName.confidence);
    updateField(dossier, "state", state.value, state.confidence);
    if (uboList.length) dossier.ubo_list = uboList;

    const flags = Array.isArray(dossier.regulatory_flags) ? [...dossier.regulatory_flags] : [];
    const missingFlags = [];

    if (!entityName.value) missingFlags.push("MISSING_ENTITY_NAME");
    if (!state.value) missingFlags.push("MISSING_STATE");
    if (!uboList.length) missingFlags.push("NO_UBO_OVER_25");

    if (missingFlags.length) {
      dossier.kyb_status = "REJECTED";
      for (const flag of missingFlags) {
        if (!flags.includes(flag)) flags.push(flag);
      }
    } else {
      dossier.kyb_status = "APPROVED";
    }

    dossier.regulatory_flags = flags;

    await fs.writeFile(DOSSIER_PATH, `${JSON.stringify(dossier, null, 2)}\n`, "utf-8");

    return res.json({
      ok: true,
      log: `entity_name: ${entityName.value || "N/A"}\nstate: ${state.value || "N/A"}\nubos_over_25: ${uboList.length}\nkyb_status: ${dossier.kyb_status}`,
      dossier
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: err?.message });
  }
});

const PORT = process.env.PORT || 5174;
app.listen(PORT, () => {
  console.log(`KYB server listening on ${PORT}`);
});
