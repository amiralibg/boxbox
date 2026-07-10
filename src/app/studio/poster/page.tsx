import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Circuit Poster Studio",
  description: "Build and export configurable Formula One circuit plates from season-specific geometry.",
  alternates: { canonical: "/studio/poster" },
};

export { default } from "@/app/poster/page";
