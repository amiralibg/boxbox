import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, display: "flex", position: "relative", background: "#080c0d" }}>
        <div style={{ position: "absolute", left: 28, top: 28, width: 14, height: 124, background: "#e10600" }} />
        <div style={{ position: "absolute", left: 65, top: 43, width: 72, height: 43, background: "#edf3f3", transform: "skewX(22deg)" }} />
        <div style={{ position: "absolute", left: 65, top: 94, width: 72, height: 43, background: "#a3b0b2", transform: "skewX(22deg)" }} />
        <div style={{ position: "absolute", left: 108, top: 58, width: 18, height: 18, borderRadius: 18, background: "#e10600" }} />
      </div>
    ),
    size,
  );
}
