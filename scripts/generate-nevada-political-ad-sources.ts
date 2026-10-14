import fs from "node:fs";
import path from "node:path";

type PoliticalAdSourceRegistryRecord = {
  id: string;
  name: string;
  provider: "meta" | "google" | "fec" | "fcc" | "nevada_sos" | "manual";
  coverage: string;
  sourceUrl: string;
  accessModel: "api_key_required" | "export_required" | "public_web" | "public_files" | "manual_review";
  status: "configured" | "needs_credentials" | "needs_export" | "adapter_pending" | "reference_only";
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
    sourceUrl: "https://www.facebook.com/ads/library/",
    accessModel: "api_key_required",
    status: process.env.META_AD_LIBRARY_ACCESS_TOKEN ? "configured" : "needs_credentials",
    notes: "Use this for source-backed digital ad captures once META_AD_LIBRARY_ACCESS_TOKEN is configured. Raw captures should remain in review until source metadata and sponsor fields are checked.",
  },
  {
    id: "google-political-ads-transparency-nevada",
    name: "Google Political Ads Transparency data - Nevada",
    provider: "google",
    coverage: "Google political ads transparency exports and public data for advertiser, spend, geography, and creative metadata when available.",
    sourceUrl: "https://adstransparency.google.com/",
    accessModel: "public_web",
    status: fs.existsSync(path.join(process.cwd(), "data/imports/political-ads/google-political-ads.json")) ? "configured" : "reference_only",
    notes: "Public advertiser search is available. A reviewed export or approved adapter is still required before records enter the repository.",
  },
  {
    id: "fec-independent-expenditures-nevada",
    name: "FEC independent expenditure filings - Nevada federal races",
    provider: "fec",
    coverage: "Federal independent expenditures and communication spending related to Nevada federal candidates and committees.",
    sourceUrl: "https://api.open.fec.gov/developers/",
    accessModel: "public_web",
    status: "configured",
    notes: "The public DEMO_KEY supports bounded collection when FEC_API_KEY is absent. These are spend/dissemination records, not ad creative.",
  },
  {
    id: "fcc-nevada-political-files",
    name: "FCC public inspection political files - Nevada stations and systems",
    provider: "fcc",
    coverage: "Political time orders and related public files uploaded by Nevada television, radio, cable, DBS, and satellite-radio entities.",
    sourceUrl: "https://publicfiles.fcc.gov/",
    accessModel: "public_files",
    status: "adapter_pending",
    notes: "The public file and station RSS routes are available. A Nevada station/system registry must be completed before unattended collection is considered comprehensive.",
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
        adapterPending: records.filter((record) => record.status === "adapter_pending").length,
      },
    },
    null,
    2,
  ),
);

console.log("Generated Nevada political ad source registry.");
console.log(JSON.stringify({ path: OUTPUT_PATH, sources: records.length }, null, 2));
