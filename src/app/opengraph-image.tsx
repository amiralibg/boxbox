import { ImageResponse } from "next/og";

export const alt = "BoxBox — Formula One Data System";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#080c0d",
          color: "#edf3f3",
          fontFamily: "Arial, sans-serif",
          padding: "58px 64px",
        }}
      >
        <div style={{ position: "absolute", inset: 0, display: "flex", opacity: 0.18 }}>
          <svg width="1200" height="630" viewBox="0 0 1200 630">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M32 0H0V32" fill="none" stroke="#647275" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="1200" height="630" fill="url(#grid)" />
          </svg>
        </div>
        <div style={{ position: "absolute", right: -40, top: 72, display: "flex", opacity: 0.72 }}>
          <svg width="650" height="500" viewBox="0 0 650 500">
            <path d="M38 412C115 300 60 164 180 91c99-60 164 38 117 108-38 57-120 17-83-29 38-47 84 9 137 33 71 32 161-6 239 61 67 58-20 145-105 104-82-40-157-36-201 24-31 43-4 77 34 81" fill="none" stroke="#172022" strokeWidth="30" strokeLinecap="round" />
            <path d="M38 412C115 300 60 164 180 91c99-60 164 38 117 108-38 57-120 17-83-29 38-47 84 9 137 33 71 32 161-6 239 61 67 58-20 145-105 104-82-40-157-36-201 24-31 43-4 77 34 81" fill="none" stroke="#a3b0b2" strokeWidth="3" strokeLinecap="round" />
            <path d="M475 359l20-8 17 13-20 8 7 11-22-4-10-15 8-5Z" fill="#e10600" />
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 70, height: 70, borderRadius: 8, background: "#080c0d", border: "1px solid #263234", display: "flex", position: "relative" }}>
              <div style={{ position: "absolute", left: 11, top: 10, width: 6, height: 50, background: "#e10600" }} />
              <div style={{ position: "absolute", left: 26, top: 16, width: 30, height: 18, background: "#edf3f3", transform: "skewX(22deg)" }} />
              <div style={{ position: "absolute", left: 26, top: 37, width: 30, height: 18, background: "#a3b0b2", transform: "skewX(22deg)" }} />
              <div style={{ position: "absolute", left: 44, top: 22, width: 7, height: 7, borderRadius: 7, background: "#e10600" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>BOXBOX</div>
              <div style={{ marginTop: 5, color: "#647275", fontSize: 12, letterSpacing: 4 }}>FORMULA ONE DATA SYSTEM</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", width: 700 }}>
            <div style={{ color: "#e10600", fontSize: 13, letterSpacing: 4, fontWeight: 700 }}>TECHNICAL LAB / DATA STUDIO</div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 18, fontSize: 70, lineHeight: 0.96, letterSpacing: -4, fontWeight: 750 }}>
              <span>Read the race.</span>
              <span>Not the broadcast.</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 25, color: "#a3b0b2", fontSize: 19, lineHeight: 1.4 }}>
              <span>Telemetry replay · lap comparison · teammate analysis</span>
              <span>circuit geometry · configurable exports</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 38, borderTop: "1px solid #263234", paddingTop: 17, color: "#647275", fontSize: 12, letterSpacing: 2 }}>
            <span>OPENF1 / 2023—NOW</span>
            <span>F1DB / 1950—NOW</span>
            <span>MULTIVIEWER / CIRCUIT GEOMETRY</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
