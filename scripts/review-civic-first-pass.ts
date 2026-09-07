import "@/lib/env/load-local-env";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { firstPassVote, firstPassIdentity, identityReviewBuckets, type IdentityCandidate } from "@/lib/admin/operations/first-pass";
import { REPORTING_POLICY_VERSION, routineReportingExclusion, type ReportingSubject } from "@/lib/public-meetings/reporting-policy";

const read = (name: string) => JSON.parse(readFileSync(`data/generated/${name}`, "utf8"));
async function main() {
  const audit = read("public-meeting-vote-extraction-audit.json");
  const items: Array<ReportingSubject & { id: string }> = read("public-meeting-items.json");
  const byId = new Map(items.map(item => [item.id, item]));
  const decisions: Array<{ itemId: string; reviewType: string; status: string; notes: string; category: string; title: string; sourceUrl?: string | null }> = [];
  for (const [key, reviewType] of [["ambiguousVoteActions", "ambiguous_vote"], ["attendanceReviewActions", "attendance_review"], ["distributionReviewActions", "distribution_review"]]) {
    for (const item of audit[key] ?? []) {
      const evidence = { ...item, sourceSnippet: item.sourceSnippet ?? item.outcome?.sourceSnippet, ...byId.get(item.meeting_item_id) };
      decisions.push({ itemId: item.meeting_item_id, reviewType, title: item.title, sourceUrl: item.source_url, ...firstPassVote(evidence, reviewType) });
    }
  }
  for (const item of identityReviewBuckets(read("public-meeting-attendance.json").records as IdentityCandidate[])) {
    const variants = item.variantNames.map(firstPassIdentity);
    const review = new Set(variants.map(row => row.status)).size > 1
      ? { status: "needs_roster", category: "identity_key_collision", notes: "Automated first pass: multiple extracted identity labels share this historical review ID. Resolve the identity grouping before approving attribution." }
      : variants[0];
    decisions.push({ itemId: item.itemId, reviewType: "identity_quality", title: `${item.personName} · ${item.organizationId} · ${item.attendanceStatus}`, ...review });
  }
  // Normalized historical identity IDs can collide. Conflicting classifications
  // stay open rather than allowing a fragment to close a valid-name review.
  const unique = new Map<string, typeof decisions[number]>();
  for (const row of decisions) {
    const key = JSON.stringify([row.reviewType, row.itemId]); const prior = unique.get(key);
    if (prior && prior.status !== row.status) unique.set(key, { ...row, status: "needs_roster", category: "identity_key_collision", notes: "Automated first pass: multiple extracted identity labels share this historical review ID. Resolve the identity grouping before approving attribution." });
    else if (!prior) unique.set(key, row);
  }
  const rows = [...unique.values()];
  const categories = rows.reduce<Record<string, number>>((counts, row) => { counts[row.category] = (counts[row.category] ?? 0) + 1; return counts; }, {});
  const report = { generatedAt: new Date().toISOString(), policyVersion: REPORTING_POLICY_VERSION, method: "Automated conservative first-pass triage of all queue records and source-item evidence; not a manual verification of every PDF or named vote.", queueRecords: decisions.length, distinctDecisions: rows.length, categories, excludedSourceItems: items.filter(item => routineReportingExclusion(item)).length, decisions: rows };
  mkdirSync(".local", { recursive: true });
  writeFileSync(".local/civic-first-pass-review.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, decisions: undefined }));
  if (!process.argv.includes("--apply")) return;
  const reviewerUserId = "agent:civic-first-pass";
  const reviewerName = "Astra automated first pass";
  let inserted = 0; let preserved = 0;
  // Serializable transactions preserve any concurrent admin review. New records
  // only; existing notes and decisions are never overwritten by the batch.
  for (let offset = 0; offset < rows.length; offset += 100) {
    const chunk = rows.slice(offset, offset + 100);
    await prisma.$transaction(async tx => {
      const existing = await tx.humanReviewDecision.findMany({ where: { OR: chunk.map(({ itemId, reviewType }) => ({ itemId, reviewType })) }, select: { itemId: true, reviewType: true } });
      const keys = new Set(existing.map(row => JSON.stringify([row.reviewType, row.itemId])));
      const fresh = chunk.filter(row => !keys.has(JSON.stringify([row.reviewType, row.itemId])));
      await tx.humanReviewDecision.createMany({ data: fresh.map(({ itemId, reviewType, status, notes }) => ({ itemId, reviewType, status, notes, reviewerUserId, reviewerName })) });
      await tx.identitySecurityEvent.createMany({ data: fresh.map(({ itemId, reviewType, status, category }) => ({ id: `review_${randomUUID()}`, actorAccountId: reviewerUserId, eventType: "human_review_workflow_updated", summary: "Authorized automated civic first-pass triage.", metadata: { itemId, reviewType, status, category, policyVersion: REPORTING_POLICY_VERSION, reviewerName } })) });
      inserted += fresh.length; preserved += existing.length;
    }, { isolationLevel: "Serializable" });
  }
  console.log(JSON.stringify({ applied: inserted, existingReviewsPreserved: preserved }));
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error instanceof Error ? error.message : "first_pass_failed"); process.exitCode = 1; });
