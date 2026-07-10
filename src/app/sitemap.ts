import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const routes = [
  "",
  "/lab",
  "/lab/replay",
  "/lab/ghost",
  "/lab/h2h",
  "/studio",
  "/studio/poster",
  "/studio/scenarios",
  "/studio/recap",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.map((route) => ({
    url: new URL(route || "/", SITE_URL).toString(),
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/lab/replay" ? 0.9 : 0.7,
  }));
}
