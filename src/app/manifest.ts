import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BoxBox — Formula One Data System",
    short_name: "BoxBox",
    description: "Technical Formula One telemetry, historical analysis and configurable data exports.",
    start_url: "/",
    display: "standalone",
    background_color: "#080c0d",
    theme_color: "#080c0d",
    orientation: "any",
    categories: ["sports", "data", "utilities"],
    icons: [
      { src: "/brand/boxbox-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/brand/boxbox-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
