import express from "express";
import multer from "multer";
import { promises as fs } from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import xlsx from "xlsx";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const DATA_DIR = path.join(process.cwd(), "data");
const DOSSIER_PATH = path.join(DATA_DIR, "company_dossier.json");
const CREDIT_MEMO_PATH = path.join(DATA_DIR, "Credit_Memo.md");
const SALES_BRIEF_PATH = path.join(DATA_DIR, "Sales_Brief.md");

const ENTITY_NAME_RE = /\bENTITY\s+NAME\b\s*[:\-]\s*(.+)/i;
const STATE_RE = /\bSTATE\s+OF\s+REGISTRATION\b\s*[:\-]\s*(.+)/i;
const ENTITY_HINT_RE =
  /\b([A-Z][A-Za-z0-9&.,'\- ]+\b(?:LLC|L\.L\.C\.|CORP|CORPORATION|INC|INC\.|LTD|L\.T\.D\.))\b/i;
const PCT_RE = /(\d+(?:\.\d+)?)\s*%/;

const FINANCIAL_FIELDS = {
  gross_revenue: ["gross revenue", "revenue", "total revenue"],
  operating_expenses: ["operating expenses", "opex", "operating expense"],
  depreciation: ["depreciation"],
  annual_debt_service: ["total annual debt service", "annual debt service", "debt service"],
  proposed_loan_amount: ["proposed loan amount", "loan amount"]
};

const PROHIBITED_INDUSTRIES = {
  cannabis: ["cannabis", "marijuana", "thc", "weed"],
  weapons_firearms: ["weapon", "weapons", "firearm", "firearms", "ammo", "ammunition"],
  gambling: ["gambling", "casino", "sportsbook", "betting"],
  adult_entertainment: ["adult", "porn", "pornography", "sex", "escort"],
  sanctioned_jurisdictions: ["sanctioned", "jurisdiction"]
};

const LIQUIDITY_PATTERNS = [/\binvestment\b/i, /\bvc\b/i, /\bventure\b/i, /private equity/i, /\bpe\b/i];

const stripBullets = (line) => line.replace(/^[\s\-*\u2022]+/, "").trim();

const ensureDataDir = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
};

const loadDossier = async () => {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(DOSSIER_PATH, "utf-8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeDossier = async (dossier) => {
  await ensureDataDir();
  await fs.writeFile(DOSSIER_PATH, `${JSON.stringify(dossier, null, 2)}\n`, "utf-8");
};

const csvToText = (raw) => {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return "";
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const hasTxnHeader =
    header.includes("id") &&
    header.includes("amount") &&
    header.includes("currency") &&
    header.includes("source");

  if (hasTxnHeader) {
    const idIdx = header.indexOf("id");
    const amountIdx = header.indexOf("amount");
    const currencyIdx = header.indexOf("currency");
    const sourceIdx = header.indexOf("source");
    return lines
      .slice(1)
      .map((line) => {
        const cols = line.split(",").map((c) => c.trim());
        return `id=${cols[idIdx] || ""}, amount=${cols[amountIdx] || ""}, currency=${cols[currencyIdx] || ""}, source=${cols[sourceIdx] || ""}`;
      })
      .join("\n");
  }

  return lines.join("\n");
};

const sheetToText = (buffer) => {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const lines = [];
  workbook.SheetNames.forEach((name) => {
    const sheet = workbook.Sheets[name];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    rows.forEach((row) => {
      if (!row || !row.length) return;
      const cells = row.map((cell) => String(cell).trim()).filter((cell) => cell);
      if (!cells.length) return;
      lines.push(cells.join(" | "));
      if (cells.length >= 2 && cells[0]) {
        lines.push(`${cells[0]}: ${cells[1]}`);
      }
    });
  });
  return lines.join("\n");
};

const fileToText = async (file) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ext === ".docx") {
    const { value } = await mammoth.extractRawText({ buffer: file.buffer });
    return value || "";
  }

  if (ext === ".doc") {
    // Best-effort fallback for legacy DOC.
    return file.buffer.toString("utf-8");
  }

  if (ext === ".pdf") {
    const data = await pdfParse(file.buffer);
    return data.text || "";
  }

  if (ext === ".xls" || ext === ".xlsx") {
    return sheetToText(file.buffer);
  }

  if (ext === ".csv") {
    return csvToText(file.buffer.toString("utf-8"));
  }

  return file.buffer.toString("utf-8");
};

const extractEntityName = (text) => {
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(ENTITY_NAME_RE);
    if (match) return { value: match[1].trim(), confidence: "explicit" };
  }
  const corporationName = text.match(/name of the corporation is\s+(.+?)(?:\.|\(|\n)/i);
  if (corporationName?.[1]) {
    return { value: corporationName[1].trim(), confidence: "inferred" };
  }
  const titleName = text.match(/articles of incorporation\s*\n\s*([^\n]+)/i);
  if (titleName?.[1]) {
    return { value: titleName[1].trim(), confidence: "inferred" };
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
  const stateOf = text.match(/\bstate of\s+([A-Za-z ]+)(?:\s*[-\n]|$)/i);
  if (stateOf?.[1]) {
    return { value: stateOf[1].trim(), confidence: "inferred" };
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

const normalizeName = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const splitName = (value) => {
  const parts = normalizeName(value).split(" ");
  if (!parts.length) return { first: "", last: "" };
  return { first: parts[0], last: parts[parts.length - 1] };
};

const sanctionsMatch = (uboName, sanctionsName) => {
  const uboNorm = normalizeName(uboName);
  const sancNorm = normalizeName(sanctionsName);
  if (!uboNorm || !sancNorm) return false;
  if (uboNorm === sancNorm) return true;
  if (uboNorm.includes(sancNorm) || sancNorm.includes(uboNorm)) return true;

  const ubo = splitName(uboName);
  const sanc = splitName(sanctionsName);
  if (ubo.last && sanc.last && ubo.last === sanc.last) {
    if (ubo.first && sanc.first && ubo.first[0] === sanc.first[0]) return true;
  }
  return false;
};

const parseSanctionsList = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

const parseNumber = (value) => {
  if (!value) return null;
  const cleaned = String(value).replace(/,/g, "").replace(/\$/g, "").replace(/\s/g, "");
  const match = cleaned.match(/-?\d+(?:\.\d+)?(?:[kmb])?/i);
  if (!match) return null;
  const token = match[0];
  const suffix = token.slice(-1).toLowerCase();
  const base = suffix === "k" || suffix === "m" || suffix === "b" ? token.slice(0, -1) : token;
  let num = Number(base);
  if (suffix === "k") num *= 1_000;
  if (suffix === "m") num *= 1_000_000;
  if (suffix === "b") num *= 1_000_000_000;
  return Number.isNaN(num) ? null : num;
};

const extractField = (text, labels) => {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes(":")) continue;
    const [rawKey, rawValue] = line.split(":", 2);
    const key = rawKey.toLowerCase().trim();
    for (const label of labels) {
      if (key === label || key.endsWith(label)) {
        return parseNumber(rawValue);
      }
    }
  }
  for (const line of lines) {
    const lowered = line.toLowerCase();
    for (const label of labels) {
      if (!lowered.includes(label)) continue;
      if (lowered.includes("source note") || lowered.includes("profile")) continue;
      const parts = line.split(/[:\-]/, 2);
      if (parts.length > 1) return parseNumber(parts[1]);
      return parseNumber(line);
    }
  }
  return null;
};

const sumFields = (text, labels) => {
  let total = 0;
  let found = false;
  labels.forEach((label) => {
    const value = extractField(text, [label]);
    if (value != null) {
      total += value;
      found = true;
    }
  });
  return found ? total : null;
};

const formatMoney = (value) => {
  if (value == null) return "Not provided";
  return value === Math.trunc(value)
    ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatRatio = (value) => (value == null ? "Not provided" : `${value.toFixed(2)}x`);

const matchProhibitedIndustry = (businessType) => {
  if (!businessType) return null;
  const text = businessType.toLowerCase();
  for (const [key, terms] of Object.entries(PROHIBITED_INDUSTRIES)) {
    if (terms.some((term) => text.includes(term))) return key;
  }
  return null;
};

const parseTransactionLine = (line) => {
  const data = { raw: line.trim() };
  line.split(",").forEach((part) => {
    if (part.includes("=")) {
      const [key, value] = part.split("=", 2);
      data[key.trim().toLowerCase()] = value.trim();
    }
  });
  return data;
};

const parseBankStatementLine = (line) => {
  const trimmed = line.trim();
  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})(.+?)(\d{6}-\d+)\$([\d,]+\.\d{2})(?:\$([\d,]+\.\d{2}))?$/
  );
  if (!match) return null;
  const [, date, description, ref, amount] = match;
  return {
    id: ref.trim(),
    transaction_id: ref.trim(),
    date,
    source: description.trim(),
    amount,
    currency: "USD",
    raw: trimmed
  };
};

const detectSignals = (transactions) => {
  const signals = [];
  for (const tx of transactions) {
    const amount = parseNumber(tx.amount || tx.transaction_amount);
    const currency = (tx.currency || "").toUpperCase();
    const source = (tx.source || "").toLowerCase();
    const trigger = tx.id || tx.transaction_id || tx.raw;

    if (amount != null && amount > 1_000_000) {
      if (LIQUIDITY_PATTERNS.some((pattern) => pattern.test(source))) {
        signals.push({
          signal: "LIQUIDITY_EVENT",
          recommended_product: "Liquidity Management / Sweep Account",
          trigger_transaction: trigger,
          confidence: "HIGH"
        });
      }
    }

    if (currency && currency !== "USD") {
      signals.push({
        signal: "FX_EXPOSURE",
        recommended_product: "FX Forward Contracts",
        trigger_transaction: trigger,
        confidence: "HIGH"
      });
    }
  }
  return signals;
};

const buildCreditMemo = (dossier, financials, metrics) => {
  const entity = dossier.entity_name || "Business";
  const industry = dossier.industry || "Not specified";
  const decision = dossier.credit_decision || "REVIEW";

  return `# Credit Memo\n\n## 1) Executive Summary\n${entity} is requesting commercial credit. Based on the provided financials, the preliminary decision is **${decision}**.\n\n## 2) Business Overview\n- Entity: ${entity}\n- Industry: ${industry}\n\n## 3) Financial Analysis\n- Gross Revenue: ${formatMoney(financials.gross_revenue)}\n- Operating Expenses: ${formatMoney(financials.operating_expenses)}\n- Depreciation (add-back): ${formatMoney(financials.depreciation)}\n- EBITDA: ${formatMoney(metrics.ebitda)}\n- Annual Debt Service: ${formatMoney(financials.annual_debt_service)}\n- DSCR: ${formatRatio(metrics.dscr)}\n\nDepreciation is treated as a non-cash expense and added back to operating earnings when calculating EBITDA.\n\n## 4) Strengths\n- Revenue scale supports ongoing operations (subject to verification).\n- Documented financial metrics available for spreading.\n\n## 5) Risks / Weaknesses\n- Financial inputs are limited to the provided document; additional statements may be required.\n- Debt service coverage should be monitored against policy thresholds.\n\n## 6) Credit Recommendation\n**Decision:** ${decision}\n\n**Suggested Covenant:** Maintain DSCR > 1.25x.\n`;
};

const buildSalesBrief = (dossier, signals) => {
  const entity = dossier.entity_name || "Apex Logistics";
  const signalTypes = [...new Set(signals.map((s) => s.signal))];
  const products = [...new Set(signals.map((s) => s.recommended_product))];

  const opportunitySummary = signalTypes.length
    ? `Signals detected: ${signalTypes.join(", ")}.`
    : "No signals detected.";

  const productLines = products.length
    ? products.map((product) => `- ${product}: improve cash visibility and risk management.`).join("\n")
    : "- No product recommendations available.";

  const emailBody = `Hi ${entity} Team,\n\nI wanted to share a few proactive ideas based on your recent transaction activity. We are seeing signals that suggest it may be a good time to tighten liquidity visibility and evaluate FX risk management tools. Our team can help you optimize cash positioning while reducing exposure from cross-currency activity.\n\nIf it would be helpful, I can arrange a short working session to review your cash flow cadence and discuss whether a sweep structure and/or forward contracts could add value right now.\n\nBest regards,\nSenior Banking Advisor\n`;

  return `# Sales Brief\n\n## 1) Opportunity Summary\n- ${opportunitySummary}\n- Why it matters now: recent transaction patterns suggest active capital movement and cross-border exposure.\n\n## 2) Recommended Product(s)\n${productLines}\n\n## 3) Suggested Talking Points\n- Reference recent transaction activity for ${entity} without citing raw amounts.\n- Highlight how proactive treasury tools can stabilize cash flow.\n- Offer to review FX exposure and hedging options for cross-border activity.\n\n## 4) Personalized Email Draft\n${emailBody}\n`;
};

const appendFlags = (dossier, flags) => {
  const existing = Array.isArray(dossier.regulatory_flags) ? dossier.regulatory_flags : [];
  flags.forEach((flag) => {
    if (!existing.includes(flag)) existing.push(flag);
  });
  dossier.regulatory_flags = existing;
};

const appendCrossSell = (dossier, opportunities) => {
  const existing = Array.isArray(dossier.cross_sell_opportunities)
    ? dossier.cross_sell_opportunities
    : [];
  opportunities.forEach((opp) => existing.push(opp));
  dossier.cross_sell_opportunities = existing;
};

app.post(
  "/api/autopilot",
  upload.fields([
    { name: "articles", maxCount: 1 },
    { name: "financials", maxCount: 1 },
    { name: "transactions", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const files = req.files || {};
      const getFile = (name) => (files[name] && files[name][0] ? files[name][0] : null);

      const articlesFile = getFile("articles");
      const financialsFile = getFile("financials");
      const transactionsFile = getFile("transactions");

      if (!articlesFile || !financialsFile || !transactionsFile) {
        return res.status(400).json({
          error: "Missing required files",
          detail: "Upload articles, financials, and transaction log."
        });
      }

      const articlesText = await fileToText(articlesFile);
      const financialsText = await fileToText(financialsFile);
      const transactionsText = await fileToText(transactionsFile);

      const sanctionsText = await fs.readFile(path.join(DATA_DIR, "sanctions_list.txt"), "utf-8");

      const dossier = await loadDossier();

      // KYB
      const entityName = extractEntityName(articlesText);
      const state = extractState(articlesText);
      const uboList = buildUboList(articlesText);

      updateField(dossier, "entity_name", entityName.value, entityName.confidence);
      updateField(dossier, "state", state.value, state.confidence);
      if (uboList.length) dossier.ubo_list = uboList;

      const kybMissing = [];
      if (!entityName.value) kybMissing.push("MISSING_ENTITY_NAME");
      if (!state.value) kybMissing.push("MISSING_STATE");
      if (!uboList.length) kybMissing.push("NO_UBO_OVER_25");
      if (kybMissing.length) {
        dossier.kyb_status = "REJECTED";
        appendFlags(dossier, kybMissing);
      } else {
        dossier.kyb_status = "APPROVED";
      }

      // Compliance
      const sanctionsList = parseSanctionsList(sanctionsText);
      const sanctionsHits = [];
      uboList.forEach((ubo) => {
        if (!ubo?.name) return;
        for (const sanc of sanctionsList) {
          if (sanctionsMatch(ubo.name, sanc)) {
            sanctionsHits.push({ ubo_name: ubo.name, matched_name: sanc });
            break;
          }
        }
      });

      const issuesFound = [];
      let criticalFound = false;

      if (sanctionsHits.length) {
        appendFlags(dossier, ["SANCTIONS_HIT"]);
        issuesFound.push({ type: "SANCTIONS_HIT", matches: sanctionsHits });
        criticalFound = true;
      }

      const businessType = dossier.business_type || dossier.industry || "";
      const prohibitedMatch = matchProhibitedIndustry(businessType);
      if (prohibitedMatch) {
        appendFlags(dossier, ["PROHIBITED_INDUSTRY"]);
        issuesFound.push({ type: "PROHIBITED_INDUSTRY", match: prohibitedMatch, value: businessType });
        criticalFound = true;
      }

      if (criticalFound) {
        appendFlags(dossier, ["CRITICAL"]);
        dossier.credit_decision = "BLOCKED";
      }

      dossier.compliance_summary = {
        sanctions_checked: true,
        prohibited_industry_checked: true,
        issues_found: issuesFound,
        status: criticalFound ? "CRITICAL" : "CLEAR"
      };

      // Underwriting
      const financials = {};
      Object.entries(FINANCIAL_FIELDS).forEach(([key, labels]) => {
        financials[key] = extractField(financialsText, labels);
      });

      // Real-world spreadsheets often provide component lines instead of headline totals.
      const inThousands = /\$000|usd\s*\(\$000/i.test(financialsText);
      if (financials.gross_revenue == null) {
        financials.gross_revenue = sumFields(financialsText, [
          "linehaul revenue",
          "warehousing revenue",
          "customs & other services",
          "customs & other revenue"
        ]);
      }
      if (financials.operating_expenses == null) {
        financials.operating_expenses = sumFields(financialsText, [
          "linehaul & delivery costs",
          "fuel costs",
          "labor & benefits",
          "facility & warehouse",
          "technology & communications",
          "general & administrative"
        ]);
      }
      if (financials.depreciation == null) {
        financials.depreciation = extractField(financialsText, ["depreciation & amortization"]);
      }
      if (financials.annual_debt_service == null) {
        const interest = extractField(financialsText, ["interest expense"]);
        const principal = extractField(financialsText, ["debt repayments"]);
        const leasePrincipal = extractField(financialsText, ["lease principal payments"]);
        if (interest != null || principal != null || leasePrincipal != null) {
          financials.annual_debt_service =
            (interest || 0) + Math.abs(principal || 0) + Math.abs(leasePrincipal || 0);
        }
      }

      if (inThousands) {
        [
          "gross_revenue",
          "operating_expenses",
          "depreciation",
          "annual_debt_service",
          "proposed_loan_amount"
        ].forEach((key) => {
          if (financials[key] != null) {
            financials[key] = financials[key] * 1_000;
          }
        });
      }

      const ebitda =
        financials.gross_revenue != null &&
        financials.operating_expenses != null &&
        financials.depreciation != null
          ? (financials.gross_revenue - financials.operating_expenses) + financials.depreciation
          : null;

      const dscr =
        ebitda != null && financials.annual_debt_service
          ? ebitda / financials.annual_debt_service
          : null;

      const financialsObj =
        dossier.financials && typeof dossier.financials === "object"
          ? dossier.financials
          : {};

      [
        "gross_revenue",
        "operating_expenses",
        "depreciation",
        "annual_debt_service",
        "proposed_loan_amount"
      ].forEach((key) => {
        if (financials[key] != null) financialsObj[key] = financials[key];
      });

      if (ebitda != null) financialsObj.ebitda = ebitda;
      if (dscr != null) financialsObj.dscr = dscr;

      dossier.financials = financialsObj;

      let decision = "REVIEW";
      if (dscr != null) {
        if (dscr > 1.25) decision = "APPROVE";
        else if (dscr < 1.0) decision = "DECLINE";
        else decision = "REVIEW";
      }

      if (criticalFound) {
        dossier.credit_decision = "BLOCKED";
      } else {
        dossier.credit_decision = decision;
      }

      // Risk score
      const riskReasons = [];
      if (kybMissing.length) {
        riskReasons.push("Incomplete ownership or entity data.");
      }
      if (criticalFound) {
        riskReasons.push("Compliance screening flagged a critical issue.");
      }
      if (dscr == null) {
        riskReasons.push("Debt service coverage ratio could not be calculated.");
      } else if (dscr < 1.0) {
        riskReasons.push("Debt service coverage ratio is below 1.0x.");
      } else if (dscr < 1.25) {
        riskReasons.push("Debt service coverage ratio is below 1.25x.");
      }

      let riskLevel = "LOW";
      if (criticalFound || (dscr != null && dscr < 1.0) || kybMissing.length) {
        riskLevel = "HIGH";
      } else if (dscr == null || (dscr != null && dscr < 1.25)) {
        riskLevel = "MEDIUM";
      }

      // Sales signals
      let transactions = transactionsText
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => parseTransactionLine(line))
        .filter((tx) => tx.amount || tx.transaction_amount);

      if (!transactions.length) {
        transactions = transactionsText
          .split(/\r?\n/)
          .map((line) => parseBankStatementLine(line))
          .filter((tx) => tx);
      }
      const signals = detectSignals(transactions);
      appendCrossSell(dossier, signals);

      await writeDossier(dossier);
      await fs.writeFile(CREDIT_MEMO_PATH, buildCreditMemo(dossier, financials, { ebitda, dscr }), "utf-8");
      await fs.writeFile(SALES_BRIEF_PATH, buildSalesBrief(dossier, signals), "utf-8");

      return res.json({
        ok: true,
        summary: {
          kyb_status: dossier.kyb_status || "UNKNOWN",
          compliance_status: dossier.compliance_summary.status,
          credit_decision: dossier.credit_decision || "UNKNOWN",
          cross_sell_count: Array.isArray(dossier.cross_sell_opportunities)
            ? dossier.cross_sell_opportunities.length
            : 0,
          risk_score: {
            level: riskLevel,
            reasons: riskReasons
          }
        },
        opportunities: signals,
        artifacts: {
          dossier: "/api/artifacts/company_dossier.json",
          credit_memo: "/api/artifacts/Credit_Memo.md",
          sales_brief: "/api/artifacts/Sales_Brief.md"
        }
      });
    } catch (err) {
      return res.status(500).json({ error: "Server error", detail: err?.message });
    }
  }
);

app.get("/api/artifacts/:name", async (req, res) => {
  const allowed = new Set(["company_dossier.json", "Credit_Memo.md", "Sales_Brief.md"]);
  const name = req.params.name;
  if (!allowed.has(name)) {
    return res.status(404).json({ error: "Not found" });
  }
  const filePath = path.join(DATA_DIR, name);
  try {
    await fs.access(filePath);
    return res.sendFile(filePath);
  } catch {
    return res.status(404).json({ error: "Not found" });
  }
});

const PORT = process.env.PORT || 5174;
app.listen(PORT, () => {
  console.log(`Autopilot server listening on ${PORT}`);
});
