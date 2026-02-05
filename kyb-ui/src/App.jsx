import React, { useState } from "react";

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
      setMessage("");
    } catch (err) {
      setStatus("error");
      setMessage(err?.message || "Autopilot failed.");
    }
  };

  const summary = result?.summary;
  const riskScore = summary?.risk_score;
  const opportunities = result?.opportunities || [];
  const artifacts = result?.artifacts || {};

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Commercial Lending Autopilot</p>
          <h1>Check Eligibility in 2 Minutes</h1>
          <ul className="subhead bullets">
            <li>Commercial credit simplified.</li>
            <li>Multi‑department hand‑offs replaced by a parallel‑agent heartbeat.</li>
            <li>What took 7 days is now under 2 minutes.</li>
          </ul>
        </div>
      </header>

      <main>
        <section className="autopilot-banner">
          <div className="autopilot-headline">
            COMMERCIAL LENDING AUTOPILOT: A faster path to a clear decision.
          </div>
          <div className="autopilot-line" aria-hidden="true">
            <span className="line-fill" />
            <div className="step-dot step-1">
            </div>
            <div className="step-dot step-2">
            </div>
            <div className="step-dot step-3">
            </div>
            <div className="step-dot step-4">
            </div>
          </div>
          <div className="autopilot-text" aria-live="polite">
            <span className="step-1-text">KYB Gatekeeper verifies entity and UBOs.</span>
            <span className="step-2-text">Regulatory Shield screens sanctions and prohibited industries.</span>
            <span className="step-3-text">Credit Underwriter computes EBITDA, DSCR, and decisioning.</span>
            <span className="step-4-text">Relationship Sentinel surfaces cross-sell opportunities.</span>
          </div>
        </section>

        <section className="grid">
          <section className="panel upload">
          <div className="panel-head">
            <h2>Check your eligibility</h2>
            <p>Upload the required files to assess your lending eligibility.</p>
          </div>
          <form className="upload-form" onSubmit={handleSubmit}>
            <div className="file-grid">
              <label className="file-card">
                <span className="label">Articles of Incorporation</span>
                <input
                  type="file"
                  accept=".txt,.doc,.docx,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange("articles")}
                />
                <span className="file-name">{files.articles?.name || "TXT, DOC, DOCX"}</span>
              </label>
              <label className="file-card">
                <span className="label">Financials</span>
                <input
                  type="file"
                  accept=".txt,.xls,.xlsx,.csv,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileChange("financials")}
                />
                <span className="file-name">{files.financials?.name || "TXT, XLS, XLSX, CSV"}</span>
              </label>
              <label className="file-card">
                <span className="label">Bank statement</span>
                <input
                  type="file"
                  accept=".log,.txt,.csv,.xls,.xlsx,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileChange("transactions")}
                />
                <span className="file-name">{files.transactions?.name || "LOG, TXT, CSV, XLS, XLSX"}</span>
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
                <p className={summary.kyb_status === "APPROVED" ? "ok" : "warn"}>
                  {summary.kyb_status}
                </p>
              </div>
              <div>
                <span className="label">Compliance</span>
                <p className={summary.compliance_status === "CLEAR" ? "ok" : "warn"}>
                  {summary.compliance_status}
                </p>
              </div>
              <div>
                <span className="label">Credit decision</span>
                <p
                  className={
                    summary.credit_decision === "APPROVE"
                      ? "ok"
                      : summary.credit_decision === "REVIEW"
                      ? "risk-medium"
                      : "warn"
                  }
                >
                  {summary.credit_decision}
                </p>
              </div>
              <div>
                <span className="label">Cross-sell signals</span>
                <p>{summary.cross_sell_count}</p>
              </div>
              <div>
                <span className="label">Risk score</span>
                <p
                  className={
                    riskScore?.level === "HIGH"
                      ? "warn"
                      : riskScore?.level === "MEDIUM"
                      ? "risk-medium"
                      : "ok"
                  }
                >
                  {riskScore?.level || "Pending"}
                </p>
              </div>
            </div>
          ) : (
            <p className="empty">Upload your documents and click Run to see results.</p>
          )}

          {summary && riskScore?.reasons?.length ? (
            <div className="risk-reasons">
              <p className="label">Risk drivers</p>
              <ul>
                {riskScore.reasons.map((reason, index) => (
                  <li key={`${reason}-${index}`}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

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
        </section>
      </main>
    </div>
  );
}
