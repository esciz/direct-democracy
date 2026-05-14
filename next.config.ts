import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
    async redirects() {
    return [
      {
        source: "/vote",
        destination: "/voting",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
