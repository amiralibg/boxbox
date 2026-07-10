import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Season Recap Studio",
  description: "Compose and export a configurable Formula One driver season recap.",
  alternates: { canonical: "/studio/recap" },
};

export { default } from "@/app/recap/page";
