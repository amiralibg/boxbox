import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teammate Head to Head",
  description: "Audit Formula One teammate qualifying, race pace, points and reliability over comparable rounds.",
  alternates: { canonical: "/lab/h2h" },
};

export default function HeadToHeadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
