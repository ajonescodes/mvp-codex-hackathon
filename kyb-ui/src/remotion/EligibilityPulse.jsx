import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const EligibilityPulse = ({ headline = "Eligibility Check" }) => {
  const frame = useCurrentFrame();
  const drift = (frame % 240) / 240;

  const blobX = interpolate(drift, [0, 1], [-12, 12]);
  const blobY = interpolate(drift, [0, 1], [8, -8]);
  const glow = interpolate(drift, [0, 1], [0.35, 0.5]);
  const ringScale = interpolate(drift, [0, 1], [0.98, 1.04]);

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(135deg, rgba(255,247,236,1) 0%, rgba(247,239,228,1) 55%, rgba(241,230,216,1) 100%)",
        color: "#1f1b16",
        fontFamily: "Space Grotesk, system-ui, sans-serif",
        padding: 28
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: `rgba(241, 143, 1, ${glow})`,
          filter: "blur(32px)",
          transform: `translate(${blobX}px, ${blobY}px)`
        }}
      />

      <div
        style={{
          position: "absolute",
          right: 40,
          top: 80,
          width: 220,
          height: 220,
          borderRadius: "50%",
          border: "2px solid rgba(241, 143, 1, 0.45)",
          transform: `scale(${ringScale})`
        }}
      />

      <div
        style={{
          position: "absolute",
          right: 80,
          top: 120,
          width: 150,
          height: 150,
          borderRadius: "50%",
          border: "1px dashed rgba(120, 93, 61, 0.35)",
          transform: `scale(${1 + (ringScale - 1) * 0.7})`
        }}
      />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 260 }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            margin: 0,
            color: "#6b5f52"
          }}
        >
          Real-time review
        </p>
        <h2 style={{ fontSize: 26, margin: "12px 0 8px" }}>{headline}</h2>
        <p style={{ margin: 0, color: "#6b5f52", lineHeight: 1.45 }}>
          We scan ownership, compliance, and cash flow signals to deliver a clear next step.
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 28,
          right: 28,
          display: "flex",
          gap: 10,
          flexWrap: "wrap"
        }}
      >
        {[
          "KYB screening",
          "Sanctions review",
          "Credit analysis",
          "Growth insights"
        ].map((item) => (
          <span
            key={item}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.7)",
              fontSize: 10.5,
              fontWeight: 600
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
