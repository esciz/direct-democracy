import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildEvidenceArtifact,
  buildRetrievedEvidenceRecord,
  reconcileCarsonCityOfficials,
  sha256,
  verifyOfficialHtml,
  type OfficialsNetworkDiagnostics,
  type OfficialsSourceEvidenceRecord,
} from "@/lib/officials/source-evidence";
import {
  getOfficialDirectorySources,
  getSeededCurrentOfficeholders,
  type OfficialDirectorySource,
} from "@/lib/officials/current-officeholders";

const generatedAt = "2026-06-21T00:00:00.000Z";
const fixtureRoot = path.join(process.cwd(), "data", "raw", "official-directories", "_verification-test");
const attributionPath = path.join(process.cwd(), "data", "generated", "public-meeting-votes.json");
const attributionBefore = existsSync(attributionPath) ? sha256(readFileSync(attributionPath)) : null;
const previousExecutionEnvironment = process.env.OFFICIALS_EXECUTION_ENVIRONMENT;
const previousNetworkEnabled = process.env.OFFICIALS_NETWORK_ENABLED;

process.env.OFFICIALS_EXECUTION_ENVIRONMENT = "local_network_enabled";
process.env.OFFICIALS_NETWORK_ENABLED = "true";

function officialSource(id: string) {
  const source = getOfficialDirectorySources(generatedAt).find((item) => item.id === id);
  if (!source) throw new Error(`Missing source ${id}`);
  return source;
}

function fixtureSource(source: OfficialDirectorySource, id: string): OfficialDirectorySource {
  return { ...source, id, cachedPath: null, contentHash: null };
}

function htmlDocument(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head><title>${title}</title></head>
<body>
<header>Carson City Government</header>
<main>
${body}
</main>
<footer>Free viewers are required for some attached documents. Please enable JavaScript for the best browser experience.</footer>
${"<nav>Carson City navigation public meetings services departments residents</nav>".repeat(90)}
</body>
</html>`;
}

function departmentHtml() {
  return htmlDocument("Department Directory | Carson City", `
    <h1>Department Directory</h1>
    <section>Board of Supervisors</section>
    <p>Kimberly Adams - Assessor</p>
    <p>Scott Hoen - Clerk-Recorder</p>
    <p>Garrit Pruyt - District Attorney</p>
    <p>Thomas Armstrong - Justice of the Peace, Department I</p>
    <p>Melanie Bruketta - Justice of the Peace, Department II</p>
    <p>Ken Furlong - Sheriff</p>
    <p>Andrew Rasor - Treasurer</p>
    <p>Glen Martel - City Manager</p>
    <p>Hope Sullivan - Community Development Director</p>
    <p>Sheri Russell-Benabou - Chief Financial Officer</p>
    <p>Kevin Nyberg - Acting Fire Chief</p>
    <p>Jeanne M. Freeman - Health and Human Services Director</p>
    <p>Jeff Coulam - Human Resources Director</p>
    <p>Frank Abella - Chief Information Officer</p>
    <p>Ali Banister - Chief Juvenile Probation Officer</p>
    <p>Joy Holt - Library Director</p>
    <p>Jennifer Budge - Parks and Recreation Director</p>
    <p>Sandra Doughty - Public Guardian</p>
    <p>Darren Schulz - Public Works Director</p>
    <p>Courtney Warner - Senior Center Director</p>
  `);
}

function departmentHtmlWithBoardNames() {
  return departmentHtml().replace(
    "<section>Board of Supervisors</section>",
    `<section>Board of Supervisors</section>
    <p>Lori Bagwell, Mayor</p>
    <p>Stacey Giomi, Supervisor Ward 1</p>
    <p>Maurice White, Supervisor Ward 2</p>
    <p>Curtis Horton, Supervisor Ward 3</p>
    <p>Lisa Schuette, Supervisor Ward 4</p>`,
  );
}

function boardHtml(includeWard4 = true) {
  return htmlDocument("Board of Supervisors | Carson City", `
    <h1>Board of Supervisors</h1>
    <section>Members of the Carson City Board of Supervisors include the mayor and four ward supervisors.</section>
    <p>Lori Bagwell - Mayor</p>
    <p>Stacey Giomi - Supervisor, Ward 1</p>
    <p>Maurice "Mo" White - Supervisor, Ward 2</p>
    <p>Curtis Horton - Supervisor, Ward 3</p>
    ${includeWard4 ? "<p>Lisa Schuette - Supervisor, Ward 4</p>" : ""}
  `);
}

function boardHtmlWithoutNames() {
  return htmlDocument("Board of Supervisors | Carson City", `
    <h1>Board of Supervisors</h1>
    <section>Members of the Carson City Board of Supervisors include the mayor and four ward supervisors.</section>
    <p>The Board of Supervisors provides legislative direction for Carson City.</p>
  `);
}

function staffHtml() {
  return htmlDocument("Staff Directory | Carson City", `
    <h1>Staff Directory</h1>
    <form><label>Search</label><input name="search"><label>First Name</label><label>Last Name</label></form>
    <section>Department records and staff results page 1 of 4.</section>
  `);
}

function verificationFor(source: OfficialDirectorySource, html: string, status = 200) {
  return verifyOfficialHtml(html, "text/html; charset=utf-8", status, {
    source,
    finalUrl: source.sourceUrl,
    redirectCount: 0,
  });
}

function assertValidFixtureCaches(source: OfficialDirectorySource, html: string) {
  const record = buildRetrievedEvidenceRecord({
    source,
    generatedAt,
    finalUrl: source.sourceUrl,
    httpStatus: 200,
    declaredContentType: "text/html; charset=utf-8",
    body: html,
  });
  try {
    assert.equal(record.verified, true);
    assert.ok(record.cachedPath);
    assert.ok(record.contentHash);
    assert.equal(record.verification.parserEligibility, "eligible");
    assert.equal(JSON.stringify(record).includes("Lori Bagwell - Mayor"), false, "raw HTML leaked into generated record");
    assert.ok(existsSync(path.join(process.cwd(), record.cachedPath)));
    return record;
  } finally {
    rmSync(path.join(process.cwd(), "data", "raw", "official-directories", source.id), { recursive: true, force: true });
  }
}

function evidenceRecord(source: OfficialDirectorySource, html: string): OfficialsSourceEvidenceRecord {
  const verification = verificationFor(source, html);
  assert.equal(verification.verified, true);
  const contentHash = sha256(html);
  const cachePath = path.join(fixtureRoot, `${source.id}.html`);
  mkdirSync(path.dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, html);
  return {
    sourceId: source.id,
    jurisdictionId: source.jurisdictionId,
    jurisdictionName: source.jurisdictionName,
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    finalUrl: source.sourceUrl,
    status: "retrieved_verified",
    diagnosticClassification: "verified_retrieval",
    httpStatus: 200,
    declaredContentType: "text/html; charset=utf-8",
    actualContentType: "html",
    verified: true,
    cachedPath: path.relative(process.cwd(), cachePath),
    versionedCachedPath: path.relative(process.cwd(), cachePath),
    contentHash,
    previousContentHash: null,
    bytes: Buffer.byteLength(html),
    verification,
    firstSeenAt: generatedAt,
    lastSeenAt: generatedAt,
    lastCheckedAt: generatedAt,
    lastChangedAt: generatedAt,
    errorMessage: null,
    rejectionReason: null,
  };
}

const networkDiagnostics: OfficialsNetworkDiagnostics = {
  generatedAt,
  environment: "local_network_enabled",
  runnerType: "fixture",
  commitSha: null,
  triggerType: "test",
  actor: "fixture",
  dns: "available",
  https: "available",
  networkCapability: "available",
  checkedUrls: [],
};

try {
  const department = officialSource("carson-city-department-directory");
  const board = officialSource("carson-city-board-of-supervisors");
  const staff = officialSource("carson-city-staff-directory");

  const validDepartment = verificationFor(department, departmentHtml());
  assert.equal(validDepartment.verified, true);
  assert.ok(validDepartment.negativeSignals.includes("generic_javascript_notice"));
  assert.ok(validDepartment.positiveSignals.includes("department_directory_identity"));

  const accessDenied = verificationFor(board, htmlDocument("Access Denied", "<h1>Access denied</h1><p>Cloudflare challenge. CAPTCHA required. Request blocked.</p>"));
  assert.equal(accessDenied.verified, false);
  assert.equal(accessDenied.parserEligibility, "rejected");

  const notFound = verificationFor(board, htmlDocument("404 Not Found", "<h1>Page not found</h1>"), 404);
  assert.equal(notFound.verified, false);
  assert.ok(notFound.negativeSignals.includes("http_404"));

  const jsShell = verificationFor(staff, "<!doctype html><html><head><title>Loading</title></head><body><div id=\"root\"></div><p>Please enable JavaScript.</p><script>window.app={}</script></body></html>".repeat(8));
  assert.equal(jsShell.verified, false);
  assert.equal(jsShell.parserEligibility, "needs_playwright");

  assertValidFixtureCaches(fixtureSource(department, "fixture-valid-department-directory"), departmentHtml());
  assertValidFixtureCaches(fixtureSource(board, "fixture-valid-board-of-supervisors"), boardHtml());
  assertValidFixtureCaches(fixtureSource(staff, "fixture-valid-staff-directory"), staffHtml());

  assert.equal(sha256(departmentHtml()), sha256(departmentHtml()), "unchanged source body should have a stable hash");

  const evidenceBase = buildEvidenceArtifact({
    generatedAt,
    records: [
      evidenceRecord(department, departmentHtml()),
      evidenceRecord(board, boardHtml()),
      evidenceRecord(staff, staffHtml()),
    ],
    networkDiagnostics,
    workerBackend: "fixture",
  });
  const evidence = {
    ...evidenceBase,
    provenance: {
      ...evidenceBase.provenance,
      executionEnvironment: "local_network_enabled" as const,
      networkCapability: "available" as const,
    },
  };
  const reconciliation = reconcileCarsonCityOfficials({
    evidence,
    existingRuntime: getSeededCurrentOfficeholders(generatedAt).map((record) => ({
      id: record.id,
      name: record.publicDisplayName,
      title: record.sourceTitle,
      office: record.sourceTitle,
      jurisdiction: `${record.jurisdictionName}, Nevada`,
      communityName: record.communityName,
      level: "city",
      body_name: record.governingBodyId,
      district: record.wardOrDistrict,
      department: record.department,
      role_category: record.roleCategory,
      selection_method: record.selectionMethod,
      current_status: record.currentStatus,
      acting_or_interim: record.actingOrInterim,
      source_url: record.sourceUrl,
      source_type: record.sourceType,
      source_label: record.sourcePageTitle,
      confidence: record.confidence,
      review_status: record.reviewStatus,
      needsReview: false,
      last_verified_at: record.lastVerifiedAt,
      profile_url: null,
      aliases: record.aliases,
      related_action_count: 0,
    })),
  });
  assert.equal(reconciliation.promotion.eligible, true);
  assert.equal(reconciliation.promotedRecords.filter((record) => record.sourceTitle === "Mayor").length, 1);
  assert.equal(reconciliation.promotedRecords.filter((record) => /^Supervisor, Ward [1-4]$/.test(record.sourceTitle)).length, 4);
  assert.equal(reconciliation.promotedRecords.filter((record) => /maurice/i.test(record.publicDisplayName) || record.aliases.some((alias) => /maurice/i.test(alias))).length, 1);
  assert.ok(reconciliation.promotedRecords.some((record) => record.sourceTitle === "Acting Fire Chief" && record.actingOrInterim));

  const alternateSourceEvidenceBase = buildEvidenceArtifact({
    generatedAt,
    records: [
      evidenceRecord(department, departmentHtmlWithBoardNames()),
      evidenceRecord(board, boardHtmlWithoutNames()),
      evidenceRecord(staff, staffHtml()),
    ],
    networkDiagnostics,
    workerBackend: "fixture",
  });
  const alternateSourceEvidence = {
    ...alternateSourceEvidenceBase,
    provenance: {
      ...alternateSourceEvidenceBase.provenance,
      executionEnvironment: "local_network_enabled" as const,
      networkCapability: "available" as const,
    },
  };
  const alternateSourceReconciliation = reconcileCarsonCityOfficials({ evidence: alternateSourceEvidence, existingRuntime: [] });
  assert.equal(alternateSourceReconciliation.promotion.eligible, true);
  assert.equal(alternateSourceReconciliation.promotedRecords.filter((record) => /^Supervisor, Ward [1-4]$/.test(record.sourceTitle)).length, 4);
  assert.ok(alternateSourceReconciliation.promotedRecords.filter((record) => record.roleCategory === "governing_body").every((record) => record.sourceId === "carson-city-department-directory"));

  const missingWardEvidenceBase = buildEvidenceArtifact({
    generatedAt,
    records: [
      evidenceRecord(department, departmentHtml()),
      evidenceRecord(board, boardHtml(false)),
      evidenceRecord(staff, staffHtml()),
    ],
    networkDiagnostics,
    workerBackend: "fixture",
  });
  const missingWardEvidence = {
    ...missingWardEvidenceBase,
    provenance: {
      ...missingWardEvidenceBase.provenance,
      executionEnvironment: "local_network_enabled" as const,
      networkCapability: "available" as const,
    },
  };
  const missingWardReconciliation = reconcileCarsonCityOfficials({ evidence: missingWardEvidence, existingRuntime: [] });
  assert.equal(missingWardReconciliation.promotion.eligible, false);
  assert.ok(missingWardReconciliation.promotion.blockers.some((blocker) => blocker.includes("Ward 1 through Ward 4")));

  const failed = buildRetrievedEvidenceRecord({
    source: fixtureSource(board, "fixture-access-denied"),
    generatedAt,
    finalUrl: board.sourceUrl,
    httpStatus: 200,
    declaredContentType: "text/html; charset=utf-8",
    body: htmlDocument("Access Denied", "<h1>Access denied</h1><p>CAPTCHA required. Request blocked.</p>"),
  });
  try {
    assert.equal(failed.verified, false);
    assert.equal(failed.cachedPath, null);
    assert.equal(failed.contentHash, null);
  } finally {
    rmSync(path.join(process.cwd(), "data", "raw", "official-directories-quarantine", "fixture-access-denied"), { recursive: true, force: true });
  }

  const attributionAfter = existsSync(attributionPath) ? sha256(readFileSync(attributionPath)) : null;
  assert.equal(attributionAfter, attributionBefore, "historical attribution artifacts changed during verifier tests");

  console.log("Official source verification fixtures passed.");
} finally {
  if (previousExecutionEnvironment === undefined) {
    delete process.env.OFFICIALS_EXECUTION_ENVIRONMENT;
  } else {
    process.env.OFFICIALS_EXECUTION_ENVIRONMENT = previousExecutionEnvironment;
  }
  if (previousNetworkEnabled === undefined) {
    delete process.env.OFFICIALS_NETWORK_ENABLED;
  } else {
    process.env.OFFICIALS_NETWORK_ENABLED = previousNetworkEnabled;
  }
  rmSync(fixtureRoot, { recursive: true, force: true });
}
