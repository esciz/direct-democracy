import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const INPUT_PATH = path.join(process.cwd(), "data", "generated", "nevada-public-organizations.json");
const AUDIT_PATH = path.join(process.cwd(), "data", "generated", "nevada-public-organizations-audit.json");

type OrganizationRecord = {
  id: string;
  name: string;
  category: string;
  communityIds: string[];
  websiteUrl: string;
  affiliationUrl: string;
  verificationStatus: string;
  registry: { irsMatched: boolean };
  partyProfile?: {
    party: "Democratic" | "Republican";
    networkRole: "state_party" | "county_party" | "caucus" | "club";
    relationship: string;
    parentOrganizationId: string | null;
    listingSourceUrl: string;
    platformUrl: string;
    leadershipUrl: string;
    affiliateDirectoryUrl: string;
    filingUrl: string;
    materialDisclosure: string;
  };
};

type Coverage = {
  generatedAt: string;
  totals: Record<string, number>;
  categories: string[];
  records: OrganizationRecord[];
};

function duplicates(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

async function main() {
  if (!existsSync(INPUT_PATH)) {
    throw new Error("Run organizations:nevada:collect before the Nevada organization audit.");
  }
  const coverage = JSON.parse(await readFile(INPUT_PATH, "utf8")) as Coverage;
  const duplicateIds = [...new Set(duplicates(coverage.records.map((record) => record.id)))];
  const duplicateNames = [...new Set(duplicates(coverage.records.map((record) => record.name.toLowerCase())))];
  const missingSourceRoutes = coverage.records
    .filter((record) => !record.websiteUrl || !record.affiliationUrl)
    .map((record) => record.id);
  const missingCommunityLinks = coverage.records
    .filter((record) => !record.communityIds.length)
    .map((record) => record.id);
  const exampleUrls = coverage.records
    .filter((record) => record.websiteUrl.includes("example.com") || record.affiliationUrl.includes("example.com"))
    .map((record) => record.id);
  const partyRecords = coverage.records.filter((record) => record.partyProfile);
  const statePartyRecords = partyRecords.filter((record) => record.partyProfile?.networkRole === "state_party");
  const missingStateParties = [
    "public-org-nevada-state-democratic-party",
    "public-org-nevada-republican-party",
  ].filter((id) => !statePartyRecords.some((record) => record.id === id));
  const democraticCountyParties = partyRecords.filter(
    (record) => record.partyProfile?.party === "Democratic" && record.partyProfile.networkRole === "county_party",
  );
  const republicanCountyParties = partyRecords.filter(
    (record) => record.partyProfile?.party === "Republican" && record.partyProfile.networkRole === "county_party",
  );
  const democraticCaucusesAndClubs = partyRecords.filter(
    (record) =>
      record.partyProfile?.party === "Democratic" &&
      (record.partyProfile.networkRole === "caucus" || record.partyProfile.networkRole === "club"),
  );
  const republicanListedClubs = partyRecords.filter(
    (record) => record.partyProfile?.party === "Republican" && record.partyProfile.networkRole === "club",
  );
  const missingPartySourceFields = partyRecords
    .filter(
      (record) =>
        !record.partyProfile?.listingSourceUrl ||
        !record.partyProfile.platformUrl ||
        !record.partyProfile.leadershipUrl ||
        !record.partyProfile.affiliateDirectoryUrl ||
        !record.partyProfile.filingUrl ||
        !record.partyProfile.materialDisclosure,
    )
    .map((record) => record.id);
  const unaffiliatedDirectoryRecords = partyRecords.filter(
    (record) => record.partyProfile?.relationship === "directory_listing_no_affiliation",
  );
  const failures = [
    coverage.records.length < 30 ? "The public organization directory has fewer than 30 source-backed records." : null,
    coverage.categories.length < 10 ? "The public organization directory covers fewer than 10 common affiliation categories." : null,
    duplicateIds.length ? `${duplicateIds.length} duplicate organization IDs are present.` : null,
    duplicateNames.length ? `${duplicateNames.length} duplicate organization names are present.` : null,
    missingSourceRoutes.length ? `${missingSourceRoutes.length} organizations are missing website or affiliation source routes.` : null,
    missingCommunityLinks.length ? `${missingCommunityLinks.length} organizations are not linked to a Nevada community scope.` : null,
    exampleUrls.length ? `${exampleUrls.length} organizations contain demo URLs.` : null,
    missingStateParties.length ? `${missingStateParties.length} Nevada state party organizations are missing.` : null,
    democraticCountyParties.length !== 17
      ? `The Democratic network has ${democraticCountyParties.length} county parties instead of 17.`
      : null,
    republicanCountyParties.length !== 17
      ? `The Republican network has ${republicanCountyParties.length} county parties instead of 17.`
      : null,
    democraticCaucusesAndClubs.length < 14
      ? `The Democratic network has fewer than 14 officially listed statewide caucuses and clubs.`
      : null,
    republicanListedClubs.length < 25
      ? `The Republican network has fewer than 25 state-party directory club listings.`
      : null,
    missingPartySourceFields.length
      ? `${missingPartySourceFields.length} party organizations are missing relationship, platform, leadership, directory, filing, or disclosure sources.`
      : null,
    unaffiliatedDirectoryRecords.length !== 1
      ? "The state party directory's explicitly non-affiliated Republican club is missing or duplicated."
      : null,
  ].filter((entry): entry is string => Boolean(entry));
  const output = {
    generatedAt: new Date().toISOString(),
    coverageGeneratedAt: coverage.generatedAt,
    strictPassed: failures.length === 0,
    totals: {
      ...coverage.totals,
      duplicateIds: duplicateIds.length,
      duplicateNames: duplicateNames.length,
      missingSourceRoutes: missingSourceRoutes.length,
      missingCommunityLinks: missingCommunityLinks.length,
      exampleUrls: exampleUrls.length,
      politicalPartyOrganizations: partyRecords.length,
      statePartyOrganizations: statePartyRecords.length,
      democraticCountyParties: democraticCountyParties.length,
      republicanCountyParties: republicanCountyParties.length,
      democraticCaucusesAndClubs: democraticCaucusesAndClubs.length,
      republicanListedClubs: republicanListedClubs.length,
      missingPartySourceFields: missingPartySourceFields.length,
      explicitlyUnaffiliatedDirectoryListings: unaffiliatedDirectoryRecords.length,
    },
    gaps: {
      duplicateIds,
      duplicateNames,
      missingSourceRoutes,
      missingCommunityLinks,
      exampleUrls,
      missingStateParties,
      missingPartySourceFields,
      unaffiliatedDirectoryRecords: unaffiliatedDirectoryRecords.map((record) => ({
        id: record.id,
        name: record.name,
        relationship: record.partyProfile?.relationship,
      })),
      irsUnmatched: coverage.records
        .filter((record) => !record.registry.irsMatched)
        .map((record) => ({ id: record.id, name: record.name, verificationStatus: record.verificationStatus })),
    },
    failures,
  };
  await writeFile(AUDIT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output.totals, null, 2));
  console.log(`Strict coverage: ${output.strictPassed ? "passed" : "failed"}`);
  if (process.argv.includes("--strict") && !output.strictPassed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
