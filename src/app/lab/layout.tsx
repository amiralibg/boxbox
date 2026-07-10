import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Technical Lab",
  description: "Formula One session replay, fastest-lap telemetry comparison and teammate head-to-head analysis.",
  openGraph: {
    title: "BoxBox Technical Lab",
    description: "Replay sessions, compare laps and audit teammate performance.",
  },
};

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
