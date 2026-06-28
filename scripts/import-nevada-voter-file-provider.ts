import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";

import { getVoterFileIndexPath, hashVoterMatchKey, normalizeVoterText, type VoterFileIndex } from "@/lib/identity/voter-file-provider";

const WASHOE_API_URL = "https://rovdatatransparencyapi.washoecounty.gov/api/datatransparency";
const CLARK_VOTER_FILE_PAGE_URL = "https://www.clarkcountynv.gov/government/departments/elections/reports_data_maps/voter-list-data-files";
const CLARK_ACTIVE_ZIP_URL = "https://elections.clarkcountynv.gov/VoterRequestsTV/COUNTY_active_TV.zip";
const PRIVATE_DIR = path.join(process.cwd(), "data", "private", "voter-files");
const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const AUDIT_PATH = path.join(GENERATED_DIR, "voter-file-provider-audit.json");
const SOURCE_REGISTRY_PATH = path.join(GENERATED_DIR, "voter-file-provider-sources.json");

type WashoeManifestRecord = {
  id: number;
  dateOfRecord: string;
  url: string;
  hash: string;
};

type ProviderImportResult = {
  provider: VoterFileIndex["providers"][number];
  activeMatchKeys: string[];
  source: {
    providerId: string;
    name: string;
    registryUrl: string;
    latestRecordUrl: string;
    dateOfRecord: string;
    hashVerified: boolean;
    sourceHash: string;
    publishedSourceHashAvailable: boolean;
    privateRawCache: boolean;
    privateHashedIndex: boolean;
  };
  diagnostics: {
    downloaded: boolean;
    rawCachePath: string;
    sourceHashVerified: boolean;
    publishedSourceHashAvailable: boolean;
    sourceHash: string;
  };
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function hashBufferHex(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function normalizeSourceHash(value: string) {
  return value.replace(/^0x/i, "").toUpperCase();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "DirectDemocracyVoterFileProvider/0.1",
    },
  });
  if (!response.ok) throw new Error(`fetch_failed_${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,text/plain,*/*",
      "user-agent": "DirectDemocracyVoterFileProvider/0.1",
    },
  });
  if (!response.ok) throw new Error(`fetch_failed_${response.status}`);
  return response.text();
}

async function fetchBuffer(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/csv,*/*",
      "user-agent": "DirectDemocracyVoterFileProvider/0.1",
    },
  });
  if (!response.ok) throw new Error(`download_failed_${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function indexWashoeCsv(csvText: string) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines[0] ?? "").map((header) => header.replace(/^\uFEFF/, ""));
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const requiredHeaders = ["vrVoterID", "vrNameFirst", "vrNameLast", "ppJurisdictions", "sDisplayText", "adrZip"];
  const missingHeaders = requiredHeaders.filter((header) => !headerIndex.has(header));
  if (missingHeaders.length) {
    throw new Error(`washoe_csv_missing_headers:${missingHeaders.join(",")}`);
  }
  const activeMatchKeys: string[] = [];
  let recordsIndexed = 0;
  let activeRecords = 0;

  for (const line of lines.slice(1)) {
    const row = parseCsvLine(line);
    const voterId = row[headerIndex.get("vrVoterID") ?? -1] ?? "";
    const firstName = row[headerIndex.get("vrNameFirst") ?? -1] ?? "";
    const lastName = row[headerIndex.get("vrNameLast") ?? -1] ?? "";
    const precinct = row[headerIndex.get("ppJurisdictions") ?? -1] ?? "";
    const zip = row[headerIndex.get("adrZip") ?? -1] ?? "";
    const status = row[headerIndex.get("sDisplayText") ?? -1] ?? "";
    if (!voterId || !firstName || !lastName) continue;
    recordsIndexed += 1;
    if (normalizeVoterText(status).startsWith("active")) {
      activeRecords += 1;
      activeMatchKeys.push(hashVoterMatchKey({
        countyOrJurisdiction: "Washoe County",
        countyVoterId: voterId,
        electionPrecinct: precinct,
        registeredFirstName: firstName,
        registeredLastName: lastName,
      }));
    }
    void zip;
  }

  return { activeMatchKeys, recordsIndexed, activeRecords };
}

async function importWashoeProvider(): Promise<ProviderImportResult> {
  const manifest = await fetchJson<WashoeManifestRecord[]>(WASHOE_API_URL);
  const latest = manifest[0];
  if (!latest?.url) throw new Error("washoe_manifest_empty");

  const csvBuffer = await fetchBuffer(latest.url);
  const downloadedHash = hashBufferHex(csvBuffer);
  const expectedHash = normalizeSourceHash(latest.hash);
  const hashVerified = downloadedHash === expectedHash;
  if (!hashVerified) {
    throw new Error(`washoe_hash_mismatch expected=${expectedHash} actual=${downloadedHash}`);
  }

  const rawPath = path.join(PRIVATE_DIR, `washoe-${latest.dateOfRecord.slice(0, 10)}.csv`);
  await fs.writeFile(rawPath, csvBuffer, { mode: 0o600 });

  const { activeMatchKeys, recordsIndexed, activeRecords } = indexWashoeCsv(csvBuffer.toString("utf8"));
  const provider = {
    providerId: "washoe_county_data_transparency",
    county: "Washoe County",
    sourceUrl: latest.url,
    sourceHash: expectedHash,
    dateOfRecord: latest.dateOfRecord,
    recordsIndexed,
    activeRecords,
  };

  return {
    provider,
    activeMatchKeys,
    source: {
      providerId: provider.providerId,
      name: "Washoe County Registrar of Voters Data Transparency",
      registryUrl: WASHOE_API_URL,
      latestRecordUrl: latest.url,
      dateOfRecord: latest.dateOfRecord,
      hashVerified,
      sourceHash: expectedHash,
      publishedSourceHashAvailable: true,
      privateRawCache: true,
      privateHashedIndex: true,
    },
    diagnostics: {
      downloaded: true,
      rawCachePath: rawPath,
      sourceHashVerified: hashVerified,
      publishedSourceHashAvailable: true,
      sourceHash: expectedHash,
    },
  };
}

async function discoverClarkActiveZipUrl() {
  const html = await fetchText(CLARK_VOTER_FILE_PAGE_URL);
  const links = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)]
    .map((match) => {
      try {
        return new URL(match[1] ?? "", CLARK_VOTER_FILE_PAGE_URL).href;
      } catch {
        return null;
      }
    })
    .filter((url): url is string => Boolean(url));

  return links.find((url) => /\/COUNTY_active_TV\.zip$/i.test(url)) ?? CLARK_ACTIVE_ZIP_URL;
}

function parseClarkZipDateFromUnzipList(output: string) {
  const line = output.split(/\r?\n/).find((entry) => /county_active_TV\.txt/i.test(entry));
  const match = line?.match(/\s(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2})\s+county_active_TV\.txt/i);
  if (!match) return new Date().toISOString();
  const [, date, time] = match;
  const [month, day, year] = date.split("-");
  return new Date(`${year}-${month}-${day}T${time}:00-07:00`).toISOString();
}

async function execFileText(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString("utf8"));
        return;
      }
      reject(new Error(`${command}_failed_${code}:${Buffer.concat(stderr).toString("utf8").slice(0, 500)}`));
    });
  });
}

async function indexClarkZip(zipPath: string) {
  const unzip = spawn("unzip", ["-p", zipPath], { stdio: ["ignore", "pipe", "pipe"] });
  const stderr: Buffer[] = [];
  unzip.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

  const reader = readline.createInterface({ input: unzip.stdout, crlfDelay: Infinity });
  let headers: string[] | null = null;
  let headerIndex: Map<string, number> | null = null;
  const activeMatchKeys: string[] = [];
  let recordsIndexed = 0;
  let activeRecords = 0;

  for await (const line of reader) {
    if (!line.trim()) continue;
    if (!headers) {
      headers = parseCsvLine(line).map((header) => header.replace(/^\uFEFF/, ""));
      headerIndex = new Map(headers.map((header, index) => [header, index]));
      const requiredHeaders = ["STATUS", "PRECINCT", "FIRST_NAME", "LAST_NAME", "REGISTRATION_NUM"];
      const missingHeaders = requiredHeaders.filter((header) => !headerIndex?.has(header));
      if (missingHeaders.length) {
        throw new Error(`clark_csv_missing_headers:${missingHeaders.join(",")}`);
      }
      continue;
    }

    const row = parseCsvLine(line);
    const get = (header: string) => row[headerIndex?.get(header) ?? -1] ?? "";
    const status = get("STATUS");
    const precinct = get("PRECINCT");
    const firstName = get("FIRST_NAME");
    const lastName = get("LAST_NAME");
    const voterId = get("REGISTRATION_NUM");
    if (!voterId || !firstName || !lastName || !precinct) continue;
    recordsIndexed += 1;
    if (normalizeVoterText(status) === "a" || normalizeVoterText(status).startsWith("active")) {
      activeRecords += 1;
      activeMatchKeys.push(hashVoterMatchKey({
        countyOrJurisdiction: "Clark County",
        countyVoterId: voterId,
        electionPrecinct: precinct,
        registeredFirstName: firstName,
        registeredLastName: lastName,
      }));
    }
  }

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    unzip.on("error", reject);
    unzip.on("close", resolve);
  });
  if (exitCode !== 0) {
    throw new Error(`clark_unzip_failed_${exitCode}:${Buffer.concat(stderr).toString("utf8").slice(0, 500)}`);
  }

  return { activeMatchKeys, recordsIndexed, activeRecords };
}

async function importClarkProvider(): Promise<ProviderImportResult> {
  const activeZipUrl = await discoverClarkActiveZipUrl();
  const zipBuffer = await fetchBuffer(activeZipUrl);
  const downloadedHash = hashBufferHex(zipBuffer);
  const rawPath = path.join(PRIVATE_DIR, "clark-county-active-tv.zip");
  await fs.writeFile(rawPath, zipBuffer, { mode: 0o600 });

  const zipList = await execFileText("unzip", ["-l", rawPath]);
  const dateOfRecord = parseClarkZipDateFromUnzipList(zipList);
  const { activeMatchKeys, recordsIndexed, activeRecords } = await indexClarkZip(rawPath);
  const provider = {
    providerId: "clark_county_active_voter_file",
    county: "Clark County",
    sourceUrl: activeZipUrl,
    sourceHash: downloadedHash,
    dateOfRecord,
    recordsIndexed,
    activeRecords,
  };

  return {
    provider,
    activeMatchKeys,
    source: {
      providerId: provider.providerId,
      name: "Clark County Election Department Active Voter List File",
      registryUrl: CLARK_VOTER_FILE_PAGE_URL,
      latestRecordUrl: activeZipUrl,
      dateOfRecord,
      hashVerified: false,
      sourceHash: downloadedHash,
      publishedSourceHashAvailable: false,
      privateRawCache: true,
      privateHashedIndex: true,
    },
    diagnostics: {
      downloaded: true,
      rawCachePath: rawPath,
      sourceHashVerified: false,
      publishedSourceHashAvailable: false,
      sourceHash: downloadedHash,
    },
  };
}

async function main() {
  await fs.mkdir(PRIVATE_DIR, { recursive: true, mode: 0o700 });
  await fs.mkdir(GENERATED_DIR, { recursive: true });

  const providerResults = await Promise.all([importWashoeProvider(), importClarkProvider()]);
  const generatedAt = new Date().toISOString();
  const activeMatchKeys = [...new Set(providerResults.flatMap((provider) => provider.activeMatchKeys))];
  const index: VoterFileIndex = {
    generatedAt,
    hashVersion: "voter-file-hash-v1",
    providers: providerResults.map((result) => result.provider),
    activeMatchKeys,
  };
  await fs.writeFile(getVoterFileIndexPath(), `${JSON.stringify(index)}\n`, { mode: 0o600 });

  const sources = {
    generatedAt,
    sources: providerResults.map((result) => result.source),
  };
  const recordsIndexed = providerResults.reduce((sum, result) => sum + result.provider.recordsIndexed, 0);
  const activeRecords = providerResults.reduce((sum, result) => sum + result.provider.activeRecords, 0);
  const audit = {
    generatedAt,
    status: "voter_file_provider_imported",
    sensitiveValuesIncluded: false,
    privateRawCache: true,
    privateHashedIndex: true,
    providers: index.providers,
    diagnostics: providerResults.map((result) => ({
      providerId: result.provider.providerId,
      downloaded: result.diagnostics.downloaded,
      sourceHashPresent: Boolean(result.diagnostics.sourceHash),
      sourceHashVerified: result.diagnostics.sourceHashVerified,
      publishedSourceHashAvailable: result.diagnostics.publishedSourceHashAvailable,
      privateRawCache: true,
    })),
    totals: {
      providers: index.providers.length,
      recordsIndexed,
      activeRecords,
      activeMatchKeys: activeMatchKeys.length,
      countiesIndexed: index.providers.length,
    },
    validation: {
      downloadedAllProviders: providerResults.every((result) => result.diagnostics.downloaded),
      sourceHashesPresent: providerResults.every((result) => Boolean(result.diagnostics.sourceHash)),
      rawVoterFileNotGeneratedPublicly: true,
      hashedIndexStoredPrivately: true,
      noRawVoterIdsInGeneratedAudit: true,
      matchingFieldsAvailable: activeMatchKeys.length > 0,
    },
    pass:
      providerResults.every((result) => result.diagnostics.downloaded) &&
      providerResults.every((result) => Boolean(result.diagnostics.sourceHash)) &&
      activeMatchKeys.length > 0,
  };

  await fs.writeFile(SOURCE_REGISTRY_PATH, `${JSON.stringify(sources, null, 2)}\n`);
  await fs.writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
  console.log("Voter file provider import complete.");
  console.log(JSON.stringify({
    pass: audit.pass,
    totals: audit.totals,
    providers: index.providers.map((provider) => ({
      providerId: provider.providerId,
      county: provider.county,
      activeRecords: provider.activeRecords,
      sourceHashPresent: Boolean(provider.sourceHash),
    })),
    output: AUDIT_PATH,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
