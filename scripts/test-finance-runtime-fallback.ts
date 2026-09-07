import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { PrismaClient } from "@prisma/client";
import { campaignFinanceCardFromCoverage, getCampaignFinanceSourceCard } from "../lib/civic-data/profile-source-cards";

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
    assert.equal(card.lastCheckedAt, candidate.campaignFinance.snapshot.sourceCheckedAt ?? null);
  } finally { globalThis.prisma = previous; }
  console.log("Finance runtime fallback passed: database failure loads exact-entity published data, missing money remains unknown, explicit zero remains valid, filing counts stay honest, and source retrieval dates are preserved.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
