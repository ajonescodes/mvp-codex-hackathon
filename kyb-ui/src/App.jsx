import React, { useState } from "react";

export default function App() {
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [serverResult, setServerResult] = useState(null);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!uploadFile) return;
    setUploadStatus("loading");
    setUploadMessage("");
    setServerResult(null);

    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const response = await fetch("/api/kyb", {
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
        const message = data?.error || "Upload failed";
        throw new Error(detail ? `${message}: ${detail}` : message);
      }

      setServerResult(data);
      setUploadStatus("success");
      setUploadMessage("Processed successfully.");
    } catch (err) {
      setUploadStatus("error");
      setUploadMessage(err?.message || "Upload failed.");
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">KYB Gatekeeper</p>
          <h1>KYB Intake Portal</h1>
          <p className="subhead">
            Upload Articles of Incorporation and let the KYB agent extract
            entity data, UBOs, and update the dossier.
          </p>
        </div>
      </header>

      <main className="grid">
        <section className="panel upload">
          <div className="panel-head">
            <h2>Upload articles</h2>
            <p>Send the Articles of Incorporation to the KYB agent.</p>
          </div>
          <form className="upload-form" onSubmit={handleUpload}>
            <input
              type="file"
              accept=".txt"
              onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
            />
            <button className="btn" type="submit" disabled={!uploadFile || uploadStatus === "loading"}>
              {uploadStatus === "loading" ? "Processing..." : "Run KYB agent"}
            </button>
          </form>
          <p className="hint">TXT only for now. It will update company_dossier.json on disk.</p>
          {uploadMessage ? (
            <p className={uploadStatus === "error" ? "warn" : "ok"}>{uploadMessage}</p>
          ) : null}
          {serverResult?.log ? (
            <pre className="log-output">{serverResult.log}</pre>
          ) : null}
          {serverResult?.dossier ? (
            <div className="server-json">
              <p className="label">Updated dossier (server)</p>
              <pre className="json-output">{JSON.stringify(serverResult.dossier, null, 2)}</pre>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
