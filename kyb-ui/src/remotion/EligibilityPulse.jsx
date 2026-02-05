import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const EligibilityPulse = ({ headline = "Eligibility Check" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pulse = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 140, mass: 0.8 }
  });

  const float = (frame % 180) / 180;

  const ringScale = interpolate(pulse, [0, 1], [0.92, 1.06]);
  const glowOpacity = interpolate(pulse, [0, 1], [0.25, 0.55]);
  const driftX = interpolate(float, [0, 1], [-20, 20]);
  const driftY = interpolate(float, [0, 1], [12, -12]);

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at top, #fff4df 0%, #f7efe4 55%, #f1e6d8 100%)",
        color: "#1f1b16",
        fontFamily: "Space Grotesk, system-ui, sans-serif",
        padding: 32
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 28,
          width: 140,
          height: 140,
          borderRadius: "50%",
          background: `rgba(241, 143, 1, ${glowOpacity})`,
          filter: "blur(24px)",
          transform: `translate(${driftX}px, ${driftY}px)`
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 40,
          top: 90,
          width: 220,
          height: 220,
          borderRadius: "50%",
          border: "2px solid rgba(241, 143, 1, 0.5)",
          transform: `scale(${ringScale})`
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 70,
          top: 120,
          width: 160,
          height: 160,
          borderRadius: "50%",
          border: "1px dashed rgba(120, 93, 61, 0.35)",
          transform: `scale(${1 + (ringScale - 1) * 0.6})`
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <p
          style={{
            fontSize: 12,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            margin: 0,
            color: "#6b5f52"
          }}
        >
          Real-time review
        </p>
        <h2 style={{ fontSize: 28, margin: "12px 0 8px" }}>{headline}</h2>
        <p style={{ maxWidth: 280, margin: 0, color: "#6b5f52" }}>
          We scan ownership, compliance, and cash flow signals to deliver a clear next step.
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 32,
          right: 32,
          display: "flex",
          gap: 12,
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
              fontSize: 11,
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
