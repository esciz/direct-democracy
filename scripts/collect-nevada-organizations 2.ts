import "dotenv/config";

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "data", "seed", "nevada-public-organization-catalog.json");
const PARTY_CATALOG_PATH = path.join(ROOT, "data", "seed", "nevada-state-party-networks.json");
const RAW_ROOT = path.join(ROOT, "data", "raw", "nevada-organizations");
const IRS_CACHE_PATH = path.join(RAW_ROOT, "irs-eo-bmf-nevada.csv");
const OUTPUT_PATH = path.join(ROOT, "data", "generated", "nevada-public-organizations.json");

type CatalogSource = {
  id: string;
  name: string;
  sourceUrl: string;
  authority: string;
  cadenceDays: number;
};

type CatalogOrganization = {
  id: string;
  name: string;
  category: string;
  organizationType:
    | "coalition"
    | "labor"
    | "public_interest"
    | "special_interest"
    | "religious"
    | "nonprofit"
    | "neighborhood"
    | "professional"
    | "business"
    | "advocacy";
  description: string;
  scope: "local" | "regional" | "statewide" | "national";
  communityIds: string[];
  headquarters: string;
  websiteUrl: string;
  affiliationUrl: string;
  issueTags: string[];
  irsNames: string[];
  partyProfile?: PartyProfile;
};

type Catalog = {
  version: number;
  updatedAt: string;
  sources: CatalogSource[];
  organizations: CatalogOrganization[];
};

type PartyRelationship =
  | "state_party_organization"
  | "official_county_party"
  | "party_caucus"
  | "state_party_directory_listing"
  | "directory_listing_no_affiliation";

type PartyNetworkAffiliate = {
  id: string;
  name: string;
  networkRole: "county_party" | "caucus" | "club";
  relationship: PartyRelationship;
  communityIds: string[];
  headquarters: string;
  sourceUrl: string;
};

type PartyNetwork = {
  id: string;
  name: string;
  party: "Democratic" | "Republican";
  description: string;
  websiteUrl: string;
  affiliationUrl: string;
  headquarters: string;
  platformUrl: string;
  platformLabel: string;
  leadershipUrl: string;
  affiliateDirectoryUrl: string;
  clubDirectoryUrl?: string;
  newsUrl: string;
  filingUrl: string;
  platformTopics: string[];
  irsNames: string[];
  affiliates: PartyNetworkAffiliate[];
};

type PartyCatalog = {
  version: number;
  updatedAt: string;
  sources: CatalogSource[];
  networks: PartyNetwork[];
};

type PartyProfile = {
  party: "Democratic" | "Republican";
  networkRole: "state_party" | "county_party" | "caucus" | "club";
  relationship: PartyRelationship;
  relationshipLabel: string;
  parentOrganizationId: string | null;
  parentOrganizationName: string | null;
  listingSourceUrl: string;
  platformUrl: string;
  platformLabel: string;
  leadershipUrl: string;
  affiliateDirectoryUrl: string;
  clubDirectoryUrl: string | null;
  newsUrl: string;
  filingUrl: string;
  platformTopics: string[];
  materialDisclosure: string;
};

type WebsiteHealth = {
  checkedAt: string;
  ok: boolean;
  status: number | null;
  finalUrl: string;
  error: string | null;
};

type PreviousOutput = {
  records?: Array<{ id: string; websiteHealth?: WebsiteHealth | null }>;
};

type IrsRecord = {
  EIN: string;
  NAME: string;
  CITY: string;
  STATE: string;
  SUBSECTION: string;
  STATUS: string;
  TAX_PERIOD: string;
  NTEE_CD: string;
  SORT_NAME: string;
};

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function stableShard(value: string, shards = 7) {
  return createHash("sha256").update(value).digest().readUInt32BE(0) % shards;
}

function currentShard(shards = 7) {
  const explicit = process.argv.find((argument) => argument.startsWith("--shard="))?.split("=")[1];
  if (explicit && Number.isInteger(Number(explicit))) return Math.abs(Number(explicit)) % shards;
  return Math.floor(Date.now() / 86_400_000) % shards;
}

function relationshipLabel(relationship: PartyRelationship) {
  switch (relationship) {
    case "state_party_organization":
      return "Nevada state party organization";
    case "official_county_party":
      return "Official county party";
    case "party_caucus":
      return "Party caucus or statewide club";
    case "state_party_directory_listing":
      return "Listed in the state party club directory";
    case "directory_listing_no_affiliation":
      return "Directory listing explicitly marked not affiliated";
  }
}

function expandPartyNetworks(partyCatalog: PartyCatalog): CatalogOrganization[] {
  return partyCatalog.networks.flatMap((network) => {
    const sharedProfile = {
      party: network.party,
      platformUrl: network.platformUrl,
      platformLabel: network.platformLabel,
      leadershipUrl: network.leadershipUrl,
      affiliateDirectoryUrl: network.affiliateDirectoryUrl,
      clubDirectoryUrl: network.clubDirectoryUrl ?? null,
      newsUrl: network.newsUrl,
      filingUrl: network.filingUrl,
      platformTopics: network.platformTopics,
      materialDisclosure:
        "Platform topics, priorities, leadership, news, and affiliate relationships shown here come from party-authored sources. They are presented as the party's own material, not as neutral fact or endorsement by Direct Democracy.",
    };
    const stateParty: CatalogOrganization = {
      id: network.id,
      name: network.name,
      category: "political_party",
      organizationType: "special_interest",
      description: network.description,
      scope: "statewide",
      communityIds: ["nevada"],
      headquarters: network.headquarters,
      websiteUrl: network.websiteUrl,
      affiliationUrl: network.affiliationUrl,
      issueTags: ["Party organization", "Elections", "Candidate recruitment", ...network.platformTopics.slice(0, 3)],
      irsNames: network.irsNames,
      partyProfile: {
        ...sharedProfile,
        networkRole: "state_party",
        relationship: "state_party_organization",
        relationshipLabel: relationshipLabel("state_party_organization"),
        parentOrganizationId: null,
        parentOrganizationName: null,
        listingSourceUrl: network.websiteUrl,
      },
    };

    const affiliates = network.affiliates.map<CatalogOrganization>((affiliate) => {
      const directoryUrl =
        affiliate.networkRole === "club" && network.clubDirectoryUrl
          ? network.clubDirectoryUrl
          : network.affiliateDirectoryUrl;
      const relationshipDescription =
        affiliate.relationship === "directory_listing_no_affiliation"
          ? `This club appears in the ${network.name} club directory, which explicitly says it is not affiliated with the state party.`
          : affiliate.networkRole === "county_party"
            ? `The ${network.name} lists this organization as its official party organization for ${affiliate.headquarters.replace(", Nevada", "")}.`
            : affiliate.relationship === "party_caucus"
              ? `The ${network.name} lists this organization as a statewide party caucus or club.`
              : `This organization appears in the club directory published by the ${network.name}; the listing alone does not establish a legal affiliation.`;
      return {
        id: affiliate.id,
        name: affiliate.name,
        category: "political_party",
        organizationType: "special_interest",
        description: relationshipDescription,
        scope: affiliate.communityIds.includes("nevada") ? "statewide" : "local",
        communityIds: affiliate.communityIds,
        headquarters: affiliate.headquarters,
        websiteUrl: affiliate.sourceUrl,
        affiliationUrl: affiliate.sourceUrl,
        issueTags:
          affiliate.networkRole === "county_party"
            ? ["Party organization", "Local elections", "Community organizing"]
            : ["Party club or caucus", "Civic participation", "Community organizing"],
        irsNames: [],
        partyProfile: {
          ...sharedProfile,
          networkRole: affiliate.networkRole,
          relationship: affiliate.relationship,
          relationshipLabel: relationshipLabel(affiliate.relationship),
          parentOrganizationId: network.id,
          parentOrganizationName: network.name,
          listingSourceUrl: directoryUrl,
        },
      };
    });

    return [stateParty, ...affiliates];
  });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === "\"") {
        if (text[index + 1] === "\"") {
          field += "\"";
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === "\"") {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function parseIrsRecords(text: string): IrsRecord[] {
  const rows = parseCsv(text);
  const headers = rows.shift() ?? [];
  const index = new Map(headers.map((header, position) => [header, position]));
  const value = (row: string[], key: keyof IrsRecord) => row[index.get(key) ?? -1] ?? "";
  return rows.map((row) => ({
    EIN: value(row, "EIN"),
    NAME: value(row, "NAME"),
    CITY: value(row, "CITY"),
    STATE: value(row, "STATE"),
    SUBSECTION: value(row, "SUBSECTION"),
    STATUS: value(row, "STATUS"),
    TAX_PERIOD: value(row, "TAX_PERIOD"),
    NTEE_CD: value(row, "NTEE_CD"),
    SORT_NAME: value(row, "SORT_NAME"),
  }));
}

async function refreshIrsCache(source: CatalogSource, allowNetwork: boolean) {
  let shouldFetch = !existsSync(IRS_CACHE_PATH);
  if (!shouldFetch && allowNetwork) {
    const cacheStat = await stat(IRS_CACHE_PATH);
    shouldFetch = Date.now() - cacheStat.mtimeMs >= source.cadenceDays * 86_400_000;
  }
  if (allowNetwork && shouldFetch) {
    const response = await fetch(source.sourceUrl, {
      headers: {
        accept: "text/csv,*/*;q=0.5",
        "user-agent": "Direct Democracy Nevada organization registry collector (admin@directyourdemocracy.com)",
      },
    });
    if (!response.ok) throw new Error(`IRS Nevada EO BMF download failed: ${response.status} ${response.statusText}`);
    await mkdir(path.dirname(IRS_CACHE_PATH), { recursive: true });
    await writeFile(IRS_CACHE_PATH, Buffer.from(await response.arrayBuffer()));
  }
  return existsSync(IRS_CACHE_PATH) ? readFile(IRS_CACHE_PATH, "utf8") : "";
}

async function checkWebsite(url: string): Promise<WebsiteHealth> {
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,*/*;q=0.5",
        "user-agent": "Direct Democracy Nevada public organization directory (admin@directyourdemocracy.com)",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    await response.body?.cancel();
    return {
      checkedAt,
      ok: response.ok || response.status === 403,
      status: response.status,
      finalUrl: response.url || url,
      error: response.ok || response.status === 403 ? null : `${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      checkedAt,
      ok: false,
      status: null,
      finalUrl: url,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const catalog = await readJson<Catalog>(CATALOG_PATH, {
    version: 0,
    updatedAt: "",
    sources: [],
    organizations: [],
  });
  const partyCatalog = await readJson<PartyCatalog>(PARTY_CATALOG_PATH, {
    version: 0,
    updatedAt: "",
    sources: [],
    networks: [],
  });
  const organizations = [...catalog.organizations, ...expandPartyNetworks(partyCatalog)];
  const previous = await readJson<PreviousOutput>(OUTPUT_PATH, {});
  const previousHealth = new Map((previous.records ?? []).map((record) => [record.id, record.websiteHealth ?? null]));
  const allowNetwork = !hasFlag("--no-network") && process.env.DATAOPS_NETWORK_ENABLED !== "false";
  const irsSource = catalog.sources.find((source) => source.id === "irs-eo-bmf-nevada");
  const irsText = irsSource ? await refreshIrsCache(irsSource, allowNetwork) : "";
  const irsRecords = irsText ? parseIrsRecords(irsText) : [];
  const irsByName = new Map<string, IrsRecord[]>();
  for (const record of irsRecords) {
    for (const name of [record.NAME, record.SORT_NAME].filter(Boolean)) {
      const key = normalize(name);
      irsByName.set(key, [...(irsByName.get(key) ?? []), record]);
    }
  }

  const fullPass = hasFlag("--first-pass");
  const shard = currentShard();
  const records = [];
  const websiteChecks = new Map<string, Promise<WebsiteHealth>>();
  for (const organization of organizations) {
    const shouldCheck = allowNetwork && (fullPass || stableShard(organization.id) === shard);
    const websiteHealth = shouldCheck
      ? await (websiteChecks.get(organization.websiteUrl) ??
        (() => {
          const pending = checkWebsite(organization.websiteUrl);
          websiteChecks.set(organization.websiteUrl, pending);
          return pending;
        })())
      : previousHealth.get(organization.id) ?? null;
    const matchedIrsRecords = organization.irsNames
      .flatMap((name) => irsByName.get(normalize(name)) ?? [])
      .filter((record, index, matches) => matches.findIndex((candidate) => candidate.EIN === record.EIN) === index);
    records.push({
      ...organization,
      websiteHealth,
      registry: {
        irsMatched: matchedIrsRecords.length > 0,
        irsRecords: matchedIrsRecords.map((record) => ({
          ein: record.EIN,
          legalName: record.NAME,
          city: record.CITY,
          subsection: record.SUBSECTION,
          statusCode: record.STATUS,
          taxPeriod: record.TAX_PERIOD || null,
          nteeCode: record.NTEE_CD || null,
          sourceUrl: "https://www.irs.gov/charities-non-profits/tax-exempt-organization-search",
        })),
        nevadaBusinessSearchUrl: "https://esos.nv.gov/EntitySearch/OnlineEntitySearch",
      },
      verificationStatus: matchedIrsRecords.length
        ? websiteHealth?.ok
          ? "website_and_irs_matched"
          : "irs_matched"
        : organization.partyProfile
          ? websiteHealth?.ok
            ? "party_source_checked"
            : "party_source_registered"
        : websiteHealth?.ok
          ? "official_website_checked"
          : "source_routes_registered",
      lastCheckedAt: websiteHealth?.checkedAt ?? null,
    });
  }

  const categories = [...new Set(records.map((record) => record.category))].sort();
  const output = {
    generatedAt: new Date().toISOString(),
    catalogVersion: Math.max(catalog.version, partyCatalog.version),
    catalogUpdatedAt: [catalog.updatedAt, partyCatalog.updatedAt].sort().at(-1) ?? "",
    scheduledShard: shard,
    schedule:
      "Official websites and party directories are checked in daily shards; the IRS Nevada exempt-organization file refreshes weekly.",
    sourceBoundary:
      "An IRS match confirms a tax-exempt registry record, not endorsement, activity, membership size, or political position. Party platforms, priorities, leadership, news, and affiliate labels are party-authored material. A club directory listing establishes only that the party published the listing; it does not independently prove legal affiliation.",
    totals: {
      organizations: records.length,
      categories: categories.length,
      statewide: records.filter((record) => record.scope === "statewide").length,
      localOrRegional: records.filter((record) => record.scope === "local" || record.scope === "regional").length,
      websitesChecked: records.filter((record) => record.websiteHealth).length,
      websitesReachable: records.filter((record) => record.websiteHealth?.ok).length,
      irsRegistryMatches: records.filter((record) => record.registry.irsMatched).length,
      politicalPartyOrganizations: records.filter((record) => record.category === "political_party").length,
      democraticPartyNetwork: records.filter((record) => record.partyProfile?.party === "Democratic").length,
      republicanPartyNetwork: records.filter((record) => record.partyProfile?.party === "Republican").length,
      countyPartyOrganizations: records.filter((record) => record.partyProfile?.networkRole === "county_party").length,
      partyCaucusesAndClubs: records.filter(
        (record) => record.partyProfile?.networkRole === "caucus" || record.partyProfile?.networkRole === "club",
      ).length,
      sourceRoutesRegistered: records.length,
    },
    sources: [...catalog.sources, ...partyCatalog.sources],
    categories,
    records,
  };
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output.totals, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
