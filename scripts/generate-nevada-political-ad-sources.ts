import fs from "node:fs";
import path from "node:path";

type PoliticalAdSourceRegistryRecord = {
  id: string;
  name: string;
  provider: "meta" | "google" | "fec" | "nevada_sos" | "manual";
  coverage: string;
  sourceUrl: string;
  accessModel: "api_key_required" | "export_required" | "public_web" | "manual_review";
  status: "configured" | "needs_credentials" | "needs_export" | "reference_only";
  notes: string;
};

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "nevada-political-ad-source-registry.json");

const records: PoliticalAdSourceRegistryRecord[] = [
  {
    id: "meta-ad-library-api-nevada",
    name: "Meta Ad Library API - Nevada political and social issue ads",
    provider: "meta",
    coverage: "Facebook, Instagram, Messenger, and Meta technologies political/social issue ads delivered in the United States. Nevada targeting can be reviewed through regional delivery metadata when available.",
    sourceUrl: "https://www.facebook.com/ads/library/api/",
    accessModel: "api_key_required",
    status: process.env.META_AD_LIBRARY_ACCESS_TOKEN ? "configured" : "needs_credentials",
    notes: "Use this for source-backed digital ad captures once META_AD_LIBRARY_ACCESS_TOKEN is configured. Raw captures should remain in review until source metadata and sponsor fields are checked.",
  },
  {
    id: "google-political-ads-transparency-nevada",
    name: "Google Political Ads Transparency data - Nevada",
    provider: "google",
    coverage: "Google political ads transparency exports and public data for advertiser, spend, geography, and creative metadata when available.",
    sourceUrl: "https://transparencyreport.google.com/political-ads/home",
    accessModel: "export_required",
    status: fs.existsSync(path.join(process.cwd(), "data/imports/political-ads/google-political-ads.json")) ? "configured" : "needs_export",
    notes: "Drop reviewed Google export JSON at data/imports/political-ads/google-political-ads.json for later normalization.",
  },
  {
    id: "fec-independent-expenditures-nevada",
    name: "FEC independent expenditure filings - Nevada federal races",
    provider: "fec",
    coverage: "Federal independent expenditures and communication spending related to Nevada federal candidates and committees.",
    sourceUrl: "https://api.open.fec.gov/developers/",
    accessModel: "api_key_required",
    status: process.env.FEC_API_KEY ? "configured" : "needs_credentials",
    notes: "Useful for spend/accountability context. FEC records usually do not provide full ad creative, so they should be linked as source context rather than full ad records unless creative evidence is attached.",
  },
  {
    id: "nevada-sos-campaign-finance-ad-spend",
    name: "Nevada Secretary of State campaign finance advertising spend",
    provider: "nevada_sos",
    coverage: "Nevada campaign finance expenditure records with media, mail, digital, print, radio, television, and advertising vendor categories.",
    sourceUrl: "https://www.nvsos.gov/sos/elections/campaign-finance-reporting",
    accessModel: "public_web",
    status: fs.existsSync(path.join(process.cwd(), "data/generated/nv-sos-campaign-finance-records.json")) ? "configured" : "reference_only",
    notes: "Useful for ad-spend discovery and sponsor/vendor leads. Expenditure records are not automatically full ad records without creative/source attachment.",
  },
  {
    id: "manual-reviewed-nevada-political-ads",
    name: "Manual reviewed Nevada political ad intake",
    provider: "manual",
    coverage: "Screenshots, mailers, SMS captures, broadcast links, platform archive links, and other reviewed public ad evidence.",
    sourceUrl: "data/manual-sources/political-ads/nevada-reviewed-ads.json",
    accessModel: "manual_review",
    status: "configured",
    notes: "Use this for the first production-safe ad records. Every record must include sourceReferences or a public source URL before it is imported as reviewed.",
  },
];

fs.mkdirSync(GENERATED_DIR, { recursive: true });
fs.writeFileSync(
  OUTPUT_PATH,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      records,
      totals: {
        sources: records.length,
        configured: records.filter((record) => record.status === "configured").length,
        needsCredentials: records.filter((record) => record.status === "needs_credentials").length,
        needsExport: records.filter((record) => record.status === "needs_export").length,
      },
    },
    null,
    2,
  ),
);

console.log("Generated Nevada political ad source registry.");
console.log(JSON.stringify({ path: OUTPUT_PATH, sources: records.length }, null, 2));
