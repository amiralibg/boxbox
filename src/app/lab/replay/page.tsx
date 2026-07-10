import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Session Replay",
  description: "Reconstruct Formula One sessions from position, timing, race-control, weather, pit and telemetry channels.",
  alternates: { canonical: "/lab/replay" },
};

export { default } from "@/app/replay/page";
