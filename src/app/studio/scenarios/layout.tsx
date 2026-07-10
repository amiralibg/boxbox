import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Championship Scenarios",
  description: "Recompute Formula One championship standings with configurable rounds, results and scoring systems.",
  alternates: { canonical: "/studio/scenarios" },
};

export default function ScenariosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
