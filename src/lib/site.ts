export const SITE_NAME = "BoxBox";
export const SITE_DESCRIPTION =
  "Formula One telemetry replay, lap comparison, teammate analysis, circuit geometry and configurable data exports.";

export const SITE_URL = new URL(
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000",
);
