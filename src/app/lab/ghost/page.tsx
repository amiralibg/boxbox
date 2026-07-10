import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ghost Lap Comparison",
  description: "Compare two Formula One laps over distance with synchronized telemetry, sectors and exact finish delta.",
  alternates: { canonical: "/lab/ghost" },
};

export { default } from "@/app/ghost/page";
