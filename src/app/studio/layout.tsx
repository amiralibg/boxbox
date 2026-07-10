import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Studio",
  description: "Configurable Formula One circuit posters, championship scenarios and driver season recaps.",
  openGraph: {
    title: "BoxBox Data Studio",
    description: "Build and export configurable Formula One data graphics.",
  },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
