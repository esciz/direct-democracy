import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { HISTORICAL_TEST_IDS, resolveHistoricalIdentityTests } from "./resolve-historical-identity-tests";

const at = "2026-09-07T17:00:00.000Z";
const original = () => HISTORICAL_TEST_IDS.map(id => ({
  id: String(id), jobType: "email_delivery", status: "dead_lettered", idempotencyKey: "production-email-test:fixture-only",
  payload: { purpose: "account_email_verification", subject: "Direct Democracy production email delivery test", text: "This is a Direct Democracy production email delivery test. The generated audit contains no one-time token or provider secret.", to: "fixture-secret-recipient" },
  attempts: 1, maxAttempts: 1, queuedAt: new Date("2026-06-24T14:00:00Z"), deadLetteredAt: new Date("2026-06-24T14:00:01Z"), cancelledAt: null as Date | null,
  failureReason: "Original provider error fixture", heartbeatAt: new Date("2026-06-24T14:00:01Z"),
}));
type Job = ReturnType<typeof original>[number];
type Event = { id: string; jobId: string; eventType: string; summary: string };
function fixture() {
  const state = { jobs: original(), events: [] as Event[], failEvent: false, reads: 0, writes: 0 };
  const db = { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
    const next = structuredClone({ jobs: state.jobs, events: state.events });
    const tx = {
      $queryRawUnsafe: async (sql: string, ids: string[]) => {
        state.reads += 1;
        if (sql.includes('from "IdentityJobEvent"')) return next.events.filter(event => ids.includes(event.id) && event.eventType === "historical_test_resolved");
        assert(sql.includes('where "id"=any($1::text[])'));
        assert.deepEqual([...ids], [...HISTORICAL_TEST_IDS]);
        return next.jobs.filter(row => ids.includes(row.id));
      },
      $executeRawUnsafe: async (sql: string, ...values: unknown[]) => {
        if (sql === "SET TRANSACTION READ ONLY") return 0;
        state.writes += 1;
        if (sql.startsWith('update "IdentityJob"')) {
          assert(!/failureReason|deadLetteredAt|payload|attempts|delete/i.test(sql), "Original provider failure and job evidence must not be rewritten");
          let count = 0;
          for (const row of next.jobs) if ((values[0] as string[]).includes(row.id)) {
            const undo = sql.includes('"cancelledAt"=null');
            row.status = undo ? "dead_lettered" : "cancelled";
            row.cancelledAt = undo ? null : new Date(values[1] as string);
            count += 1;
          }
          return count;
        }
        assert(sql.startsWith('insert into "IdentityJobEvent"'));
        if (state.failEvent) throw new Error("fixture_event_write_failed");
        next.events.push({ id: values[0] as string, jobId: values[1] as string, eventType: values[2] as string, summary: values[3] as string });
        return 1;
      },
    };
    const result = await callback(tx);
    state.jobs = next.jobs;
    state.events = next.events;
    return result;
  } } as unknown as PrismaClient;
  return { state, db };
}

async function main() {
  const f = fixture();
  const realJob = { ...original()[0], id: "real-signup-delivery", idempotencyKey: "signup", payload: { ...original()[0].payload, subject: "Verify your email" } };
  f.state.jobs.push(realJob);
  const before = structuredClone(f.state.jobs);
  const plan = await resolveHistoricalIdentityTests(f.db, { mode: "plan", resolutionAt: at });
  assert.equal(plan.changed, 0);
  assert.equal(f.state.writes, 0, "Planning must perform no identity writes");
  const receipt = await resolveHistoricalIdentityTests(f.db, { mode: "resolve", resolutionAt: at });
  assert.equal(receipt.changed, 2);
  assert.equal(receipt.emailsSent, 0);
  assert(!JSON.stringify(receipt).includes("fixture-secret-recipient"));
  assert.deepEqual(f.state.jobs[2], before[2], "Genuine failed delivery remains untouched");
  assert.equal(f.state.events.length, 2);
  for (let i = 0; i < 2; i += 1) assert.deepEqual(f.state.jobs[i], { ...before[i], status: "cancelled", cancelledAt: new Date(at) });
  await assert.rejects(resolveHistoricalIdentityTests(f.db, { mode: "resolve", resolutionAt: at }), /state_mismatch/);
  await assert.rejects(resolveHistoricalIdentityTests(f.db, { mode: "undo", resolutionAt: "2026-09-07T17:01:00.000Z" }), /undo_state_mismatch/);
  await resolveHistoricalIdentityTests(f.db, { mode: "undo", resolutionAt: at });
  assert.deepEqual(f.state.jobs, before, "Undo restores the exact original job rows");
  assert.equal(f.state.events.length, 4, "Undo appends history instead of deleting resolution events");

  const mutations: Array<(row: Job) => void> = [
    row => { row.jobType = "scheduled_health_check"; }, row => { row.status = "queued"; },
    row => { row.idempotencyKey = "real-signup"; }, row => { row.payload.subject = "Verify account"; },
    row => { row.payload.text = "Real verification token"; }, row => { row.payload.purpose = "password_reset"; },
    row => { row.maxAttempts = 3; }, row => { row.attempts = 2; },
    row => { row.queuedAt = new Date("2026-09-07T14:00:00Z"); }, row => { row.deadLetteredAt = new Date("2026-09-07T14:00:00Z"); },
    row => { row.cancelledAt = new Date(at); },
  ];
  for (const mutate of mutations) {
    const invalid = fixture();
    mutate(invalid.state.jobs[0]);
    await assert.rejects(resolveHistoricalIdentityTests(invalid.db, { mode: "resolve", resolutionAt: at }), /mismatch/);
    assert.equal(invalid.state.writes, 0, "Every evidence/state guard must pass before any write");
  }
  const missing = fixture(); missing.state.jobs.pop();
  await assert.rejects(resolveHistoricalIdentityTests(missing.db, { mode: "resolve", resolutionAt: at }), /inventory_mismatch/);
  const interrupted = fixture(); interrupted.state.failEvent = true;
  await assert.rejects(resolveHistoricalIdentityTests(interrupted.db, { mode: "resolve", resolutionAt: at }), /fixture_event_write_failed/);
  assert.deepEqual(interrupted.state.jobs, original(), "An audit-event failure rolls back both status changes");
  assert.deepEqual(interrupted.state.events, []);

  const workflow = readFileSync(".github/workflows/identity-worker.yml", "utf8");
  assert.match(workflow, /diagnostics_only:\s+description: [^\n]+\s+type: boolean\s+required: true\s+default: true/);
  for (const step of ["Run bounded worker batch", "Worker smoke test"]) assert(workflow.includes(`- name: ${step}\n        if: github.event_name != 'workflow_dispatch' || !inputs.diagnostics_only`), "Diagnostic dispatch skips job claiming and smoke creation");
  console.log("Historical identity test resolution passed: exact test evidence, atomic audited retirement, preserved real failures, reversible receipt, and no-send workflow diagnostics.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
