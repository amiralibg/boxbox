import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      { source: "/replay", destination: "/lab/replay", permanent: true },
      { source: "/ghost", destination: "/lab/ghost", permanent: true },
      { source: "/numbers", destination: "/lab/h2h", permanent: true },
      { source: "/poster", destination: "/studio/poster", permanent: true },
      { source: "/recap", destination: "/studio/recap", permanent: true },
      { source: "/live", destination: "/lab/replay", permanent: false },
    ];
  },
};

export default nextConfig;
