import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  outputFileTracingExcludes: {
    "/*": [
      "./data/manual-sources/**/*",
      "./data/raw/**/*",
      "./data/imports/**/*",
      "./data/private/**/*",
      "./data/generated/public-meeting-text/**/*",
      "./data/generated/nv-sos-text/**/*",
      "./data/generated/public-meeting-items.json",
      "./data/generated/public-meeting-voting-cards.json",
      "./data/generated/public-meetings.json",
      "./data/generated/public-meeting-provider-report.json",
      "./data/generated/public-meeting-manual-provider-report.json",
      "./data/generated/public-meeting-ingestion-report.json",
      "./data/generated/public-meeting-official-actions.json",
      "./data/generated/public-meeting-official-roster-report.json",
      "./data/generated/public-civic-cases.json",
      "./node_modules/.prisma/client/*.d.ts",
      "./node_modules/.prisma/client/* 2*",
      "./node_modules/.prisma/client/* 3*",
      "./node_modules/.prisma/client/* 4*",
      "./node_modules/.prisma/client/* 5*",
      "./node_modules/.prisma/client/* 6*",
      "./node_modules/.prisma/client/* 7*",
      "./node_modules/.prisma/client/* 8*",
      "./node_modules/.prisma/client/* 9*",
      "./node_modules/.prisma/client/* 1*",
      "./node_modules/@prisma/client/runtime/*.map",
      "./node_modules/@prisma/client/runtime/query_compiler_bg.*",
      "./node_modules/@prisma/client/runtime/query_engine_bg.*",
      "./node_modules/@prisma/engines/schema-engine-*",
      "./poppler-*",
      "./.local/**/*",
      "./.next/cache/**/*",
      "./build-next/**/*",
    ],
  },
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
