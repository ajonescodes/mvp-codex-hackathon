import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const steps = [
  { title: "KYB intake", subtitle: "Entity & ownership" },
  { title: "Compliance", subtitle: "Sanctions & industry" },
  { title: "Underwriting", subtitle: "EBITDA + DSCR" },
  { title: "Growth", subtitle: "Cross-sell insights" }
];

export const AutopilotFlow = ({ headline = "Autopilot in motion" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stepDuration = Math.round(fps * 1.6);
  const total = stepDuration * steps.length;
  const loopFrame = frame % total;
  const activeIndex = Math.floor(loopFrame / stepDuration);
  const stepProgress = (loopFrame % stepDuration) / stepDuration;

  const fill = (activeIndex + stepProgress) / steps.length;
  const glow = interpolate(stepProgress, [0, 0.6, 1], [0.25, 0.5, 0.25]);

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(140deg, rgba(255,247,236,1) 0%, rgba(247,239,228,1) 55%, rgba(241,230,216,1) 100%)",
        color: "#1f1b16",
        fontFamily: "Space Grotesk, system-ui, sans-serif",
        padding: 28
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 24,
          right: 24,
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: `rgba(241, 143, 1, ${glow})`,
          filter: "blur(32px)",
          opacity: 0.7
        }}
      />

      <div style={{ maxWidth: 240 }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            margin: 0,
            color: "#6b5f52"
          }}
        >
          Live workflow
        </p>
        <h2 style={{ fontSize: 26, margin: "12px 0 8px" }}>{headline}</h2>
        <p style={{ margin: 0, color: "#6b5f52", lineHeight: 1.45 }}>
          Four agents run in parallel to deliver a complete lending decision package.
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          top: 32,
          right: 28,
          bottom: 28,
          width: 210,
          display: "flex",
          gap: 16
        }}
      >
        <div
          style={{
            position: "relative",
            width: 8,
            borderRadius: 999,
            background: "rgba(120, 93, 61, 0.15)"
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 0,
              width: "100%",
              height: `${Math.min(1, fill) * 100}%`,
              borderRadius: 999,
              background: "rgba(241, 143, 1, 0.8)",
              transition: "height 0.2s ease"
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {steps.map((step, index) => {
            const isActive = index === activeIndex;
            const opacity = isActive ? 1 : 0.5;
            const scale = isActive
              ? interpolate(stepProgress, [0, 0.5, 1], [1, 1.05, 1])
              : 1;
            return (
              <div
                key={step.title}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  opacity,
                  transform: `scale(${scale})`
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: isActive ? "#f18f01" : "rgba(120, 93, 61, 0.3)"
                  }}
                />
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{step.title}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#6b5f52" }}>
                    {step.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
