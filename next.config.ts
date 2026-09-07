import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
    },
  },
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/*": ["./data/seed/public-meeting-sources.json"],
  },
  outputFileTracingExcludes: {
    "/*": [
      "./data/manual-sources/**/*",
      "./data/raw/**/*",
      "./data/imports/**/*",
      "./data/private/**/*",
      "./data/generated/public-meeting-text/**/*",
      // Worker evidence bytes stay in the persistent pipeline cache / object
      // store. Public and admin routes use runtime JSON, reports, and source URLs.
      "./data/generated/public-meeting-document-cache/**/*",
      "./data/generated/public-meeting-document-text-cache/**/*",
      "./data/generated/public-meeting-ocr-text-cache/**/*",
      "./data/generated/public-meeting-adapter-text-cache/**/*",
      // Detailed retrieval/extraction manifests are worker inputs. Web pages read
      // the runtime artifacts and aggregate source/cache audit reports instead.
      "./data/generated/public-meeting-source-documents.json",
      "./data/generated/public-meeting-document-cache-index.json",
      "./data/generated/public-meeting-document-text.json",
      "./data/generated/public-meeting-cache-reconciliation.json",
      "./data/generated/public-meeting-cache-quarantine.json",
      "./data/generated/public-meeting-item-processing-state.json",
      "./data/generated/public-meeting-document-refresh-state.json",
      "./data/generated/dataops-change-log.json",
      // Local Finder copies are not canonical generated artifacts or web inputs.
      "./data/generated/* 2.json",
      "./data/generated/audits/**/*",
      "./data/generated/admin-operations/**/*",
      "./data/generated/**/*.pdf",
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
    ];
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
