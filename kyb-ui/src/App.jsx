import React, { useState } from "react";
import { Player } from "@remotion/player";
import { EligibilityPulse } from "./remotion/EligibilityPulse.jsx";

export default function App() {
  const [files, setFiles] = useState({
    articles: null,
    financials: null,
    transactions: null
  });
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);

  const handleFileChange = (key) => (event) => {
    const file = event.target.files?.[0] || null;
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!files.articles || !files.financials || !files.transactions) {
      setStatus("error");
      setMessage("Upload the required files to run the autopilot.");
      return;
    }

    setStatus("loading");
    setMessage("");
    setResult(null);

    const formData = new FormData();
    formData.append("articles", files.articles);
    formData.append("financials", files.financials);
    formData.append("transactions", files.transactions);

    try {
      const response = await fetch("/api/autopilot", {
        method: "POST",
        body: formData
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const detail = data?.detail || data?.stderr || data?.stdout || "";
        const errorMessage = data?.error || "Autopilot failed";
        throw new Error(detail ? `${errorMessage}: ${detail}` : errorMessage);
      }

      setResult(data);
      setStatus("success");
      setMessage("Autopilot completed successfully.");
    } catch (err) {
      setStatus("error");
      setMessage(err?.message || "Autopilot failed.");
    }
  };

  const summary = result?.summary;
  const opportunities = result?.opportunities || [];
  const artifacts = result?.artifacts || {};

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Commercial Lending Autopilot</p>
          <h1>Check Eligibility in 60 Seconds</h1>
          <p className="subhead">
            Fast, hassle-free pre-qualification for business lending—securely
            upload your documents and get a clear decision summary.
          </p>
        </div>
        <div className="hero-media card">
          <div className="player-frame">
            <Player
              component={EligibilityPulse}
              durationInFrames={180}
              fps={30}
              compositionWidth={520}
              compositionHeight={320}
              controls={false}
              autoPlay
              loop
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="panel upload">
          <div className="panel-head">
            <h2>Check your eligibility</h2>
            <p>Upload the required files to assess your lending eligibility.</p>
          </div>
          <form className="upload-form" onSubmit={handleSubmit}>
            <div className="file-grid">
              <label className="file-card">
                <span className="label">Articles of Incorporation</span>
                <input type="file" accept=".txt" onChange={handleFileChange("articles")} />
                <span className="file-name">{files.articles?.name || "TXT file"}</span>
              </label>
              <label className="file-card">
                <span className="label">Financials</span>
                <input type="file" accept=".txt" onChange={handleFileChange("financials")} />
                <span className="file-name">{files.financials?.name || "TXT file"}</span>
              </label>
              <label className="file-card">
                <span className="label">Bank statement</span>
                <input type="file" accept=".log,.txt" onChange={handleFileChange("transactions")} />
                <span className="file-name">{files.transactions?.name || "LOG/TXT file"}</span>
              </label>
            </div>
            <button className="btn" type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Running..." : "Run Autopilot"}
            </button>
          </form>
          {message ? <p className={status === "error" ? "warn" : "ok"}>{message}</p> : null}
        </section>

        <section className="panel result">
          <div className="panel-head">
            <h2>Decision summary</h2>
            <p>Your results will appear here once processing completes.</p>
          </div>
          {summary ? (
            <div className="summary">
              <div>
                <span className="label">KYB status</span>
                <p>{summary.kyb_status}</p>
              </div>
              <div>
                <span className="label">Compliance</span>
                <p>{summary.compliance_status}</p>
              </div>
              <div>
                <span className="label">Credit decision</span>
                <p className={summary.credit_decision === "BLOCKED" ? "warn" : "ok"}>
                  {summary.credit_decision}
                </p>
              </div>
              <div>
                <span className="label">Cross-sell signals</span>
                <p>{summary.cross_sell_count}</p>
              </div>
            </div>
          ) : (
            <p className="empty">Upload your documents and click Run to see results.</p>
          )}

          <div className="opportunity-list">
            <p className="label">Opportunities we identified</p>
            {opportunities.length ? (
              opportunities.map((opp, index) => (
                <div className="ubo" key={`${opp.signal}-${index}`}>
                  <div>
                    <p className="ubo-name">{opp.signal}</p>
                    <p className="ubo-role">{opp.recommended_product}</p>
                  </div>
                  <div className="ubo-pct">{opp.confidence}</div>
                </div>
              ))
            ) : (
              <p className="empty">No opportunities identified from the submitted documents.</p>
            )}
          </div>

          {summary ? (
            <div className="download-row">
              <a className="btn secondary" href={artifacts.dossier || "#"} download>
                Download dossier
              </a>
              <a className="btn secondary" href={artifacts.credit_memo || "#"} download>
                Download credit memo
              </a>
              <a className="btn secondary" href={artifacts.sales_brief || "#"} download>
                Download sales brief
              </a>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
