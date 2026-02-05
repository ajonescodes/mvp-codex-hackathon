import express from "express";
import multer from "multer";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const ROOT = path.resolve(process.cwd(), "..");
const DOSSIER_PATH = path.join(ROOT, "company_dossier.json");
const SCRIPT_PATH = path.join(
  ROOT,
  "skills",
  "kyb-gatekeeper",
  "scripts",
  "kyb_extract.py"
);

app.post("/api/kyb", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing file upload" });
    }

    const proc = spawn("python3", [SCRIPT_PATH], {
      cwd: ROOT,
      env: {
        ...process.env,
        KYB_USE_STDIN: "1"
      }
    });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", async (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: "KYB script failed", stderr, stdout });
      }

      const dossierRaw = await fs.readFile(DOSSIER_PATH, "utf-8");
      const dossier = JSON.parse(dossierRaw);

      return res.json({
        ok: true,
        log: stdout.trim(),
        dossier
      });
    });

    proc.stdin.write(req.file.buffer);
    proc.stdin.end();
  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: err?.message });
  }
});

const PORT = process.env.PORT || 5174;
app.listen(PORT, () => {
  console.log(`KYB server listening on ${PORT}`);
});
