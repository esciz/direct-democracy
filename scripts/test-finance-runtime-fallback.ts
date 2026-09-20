import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { PrismaClient } from "@prisma/client";
import { applyFinanceSourceHealth, campaignFinanceCardFromCoverage, getCampaignFinanceSourceCard } from "../lib/civic-data/profile-source-cards";

async function main() {
  const emptyRecord = { entityType: "candidate", entityId: "fixture", campaignFinance: { primarySourceUrl: "https://www.fec.gov/data/", primarySourceName: "FEC", status: "source_registered", snapshot: null, cycleHistory: [], allReportedTotals: null }, personalFinancialDisclosure: { filings: [] } };
  const empty = campaignFinanceCardFromCoverage({ records: [emptyRecord] }, "candidate", "fixture");
  assert.equal(empty?.financialSnapshot, null);
  assert.equal(empty?.allReportedTotals, null);
  assert.equal(empty?.reviewStatus, "pending_review");
  assert.equal(campaignFinanceCardFromCoverage({ records: [emptyRecord] }, "official", "fixture"), null);
  assert.equal(campaignFinanceCardFromCoverage({ records: [emptyRecord] }, "candidate", "different-person"), null);
  const snapshot = { sourceKind: "fec", sourceName: "FEC", sourceUrl: "https://www.fec.gov/data/", cycleYear: 2026, totalRaised: 0, totalSpent: 0, cashOnHand: null, reportingPeriod: "2025–2026 cycle", sourceCheckedAt: "2026-08-01T00:00:00Z", periodEnd: null };
  const explicitZero = campaignFinanceCardFromCoverage({ records: [{ ...emptyRecord, campaignFinance: { ...emptyRecord.campaignFinance, status: "verified_totals", snapshot } }] }, "candidate", "fixture");
  assert.equal(explicitZero?.financialSnapshot?.totalRaised, 0);
  assert.equal(explicitZero?.lastCheckedAt, snapshot.sourceCheckedAt);
  assert.equal(explicitZero?.financeDocumentCount, 0);
  const derived = { ...explicitZero!, financialSnapshot: { ...snapshot, sourceKind: "transparency_usa" as const, periodStart: null, reportingPeriod: "2025–2026 cycle; source checked 2026-09-20" } };
  const observation = { url: snapshot.sourceUrl, status: "cached_after_error", attemptedAt: "2026-09-20T16:00:00Z", fetchedAt: "2026-09-20T15:00:00Z", timestampBasis: "legacy_file_mtime" };
  const stale = applyFinanceSourceHealth(derived, { sourceHealth: { attempts: [observation] } });
  assert.equal(stale.lastCheckedAt, null);
  assert.equal(stale.financialSnapshot?.sourceCheckedAt, null);
  assert.equal(stale.financialSnapshot?.totalRaised, 0);
  assert.match(stale.freshnessNote!, /refresh unavailable/i);
  assert.match(stale.financialSnapshot!.reportingPeriod, /retrieval date unknown/);
  assert.equal(derived.financialSnapshot.sourceCheckedAt, snapshot.sourceCheckedAt, "Runtime normalization must not mutate source data");
  const verifiedDate = applyFinanceSourceHealth(derived, { sourceHealth: { attempts: [{ ...observation, fetchedAt: "2026-09-07T00:00:00Z", timestampBasis: "retrieval_metadata" }] } });
  assert.equal(verifiedDate.lastCheckedAt, "2026-09-07T00:00:00Z");
  const newer = { ...derived, financialSnapshot: { ...derived.financialSnapshot, sourceCheckedAt: "2026-09-21T00:00:00Z" } };
  assert.equal(applyFinanceSourceHealth(newer, { sourceHealth: { attempts: [observation] } }), newer, "An old release must not override a newer independent retrieval");
  assert.equal(applyFinanceSourceHealth(derived, { sourceHealth: { attempts: [{ ...observation, url: "https://unrelated.example/" }] } }), derived);
  const missing = campaignFinanceCardFromCoverage({ records: [{ ...emptyRecord, campaignFinance: { ...emptyRecord.campaignFinance, snapshot: { ...snapshot, totalRaised: null } } }] }, "candidate", "fixture");
  assert.equal(missing?.financialSnapshot, null);

  const file = JSON.parse(await readFile("data/generated/nevada-financial-coverage.json", "utf8"));
  const candidate = file.records.find((record: { entityType: string; campaignFinance: { snapshot: unknown } }) => record.entityType === "candidate" && record.campaignFinance.snapshot);
  assert.ok(candidate);
  const previous = globalThis.prisma;
  const failure = new Proxy({}, { get: () => async () => { throw new Error("fixture database unavailable"); } });
  globalThis.prisma = new Proxy({}, { get: () => failure }) as PrismaClient;
  try {
    const card = await getCampaignFinanceSourceCard("candidate", candidate.entityId);
    assert.equal(card.financialSnapshot?.totalRaised, candidate.campaignFinance.snapshot.totalRaised);
    assert.equal(card.financialSnapshot?.sourceUrl, candidate.campaignFinance.snapshot.sourceUrl);
    const expected = applyFinanceSourceHealth(campaignFinanceCardFromCoverage(file, "candidate", candidate.entityId)!, file);
    assert.equal(card.lastCheckedAt, expected.lastCheckedAt);
  } finally { globalThis.prisma = previous; }
  console.log("Finance runtime fallback passed: database failure loads exact-entity published data, missing money remains unknown, explicit zero remains valid, filing counts stay honest, and source retrieval dates are preserved.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
