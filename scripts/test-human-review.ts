import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { createHumanReviewService, reviewKey, reviewIsComplete } from "../lib/admin/operations/human-review";

type Decision = { reviewType: string; itemId: string; status: string; notes: string; reviewerUserId: string; reviewerName: string; updatedAt: Date };
async function main() {
  let records = new Map<string, Decision>();
  let events: unknown[] = [];
  let failAudit = false;
  const tx = {
    humanReviewDecision: {
      findMany: async () => [...records.values()],
      upsert: async ({ create }: { create: Omit<Decision, "updatedAt"> }) => {
        records.set(reviewKey(create.reviewType, create.itemId), { ...create, updatedAt: new Date() });
      },
    },
    identitySecurityEvent: { create: async ({ data }: { data: unknown }) => {
      if (failAudit) throw new Error("fixture_audit_failed");
      events.push(data);
    } },
  };
  const db = { ...tx, $transaction: async (work: (value: typeof tx) => Promise<void>) => {
    const before = structuredClone({ records, events });
    try { await work(tx); } catch (error) { records = before.records; events = before.events; throw error; }
  } } as unknown as PrismaClient;
  const service = createHumanReviewService(db);
  const decision = { reviewType: "ambiguous_vote", itemId: "meeting-item", status: "resolved", notes: " Source checked. ", reviewerUserId: "identity_fixture", reviewerName: "Fixture Admin" };
  await service.save(decision);
  const reloaded = await createHumanReviewService(db).read();
  assert.equal(reloaded[reviewKey(decision.reviewType, decision.itemId)].notes, "Source checked.");
  assert.equal(reloaded[reviewKey(decision.reviewType, decision.itemId)].status, "resolved");
  await service.save({ ...decision, reviewType: "attendance_review", status: "needs_roster" });
  assert.equal(records.size, 2, "Two review categories for the same item must not overwrite one another");
  await service.save({ ...decision, itemId: "other-item", status: "pending" });
  assert.equal(records.size, 3, "Saving another item preserves previous decisions");
  await service.save({ ...decision, status: "pending" });
  assert.equal(records.get(reviewKey(decision.reviewType, decision.itemId))?.status, "pending", "Completed reviews can be reopened");
  assert.equal(events.length, 4, "Every saved change is audited");
  for (const bad of [{ status: "approved" }, { reviewType: "unknown" }, { itemId: " " }]) {
    await assert.rejects(service.save({ ...decision, ...bad }), /invalid_review_decision/);
  }
  assert.equal(events.length, 4);
  failAudit = true;
  await assert.rejects(service.save({ ...decision, status: "resolved" }), /fixture_audit_failed/);
  assert.equal(records.get(reviewKey(decision.reviewType, decision.itemId))?.status, "pending", "Failed audit rolls back the decision");
  assert.equal(events.length, 4);
  assert.equal(reviewIsComplete("resolved"), true);
  assert.equal(reviewIsComplete("reviewed_no_change"), true);
  for (const status of [undefined, "pending", "needs_source", "needs_roster", "deferred"]) assert.equal(reviewIsComplete(status), false);
  console.log("Human review: fresh reads, independent review categories, preserved decisions, reopening, validation, audit history and rollback passed with an isolated database.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
