import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";

export const HISTORICAL_TEST_IDS = ["job_811cbac4bc6646dd87063d92", "job_8c59c94aa210bee2f761aa14"] as const;
export const HISTORICAL_TEST_REASON = "Retired June 24 operator email tests; no resend; original provider failure retained.";
const eventId = (id: string) => `launch_test_resolution_${id}`;
type HistoricalJob = {
  id: string; jobType: string; status: string; idempotencyKey: string; payload: Record<string, unknown>;
  attempts: number; maxAttempts: number; queuedAt: Date; deadLetteredAt: Date; cancelledAt: Date | null;
};

export async function resolveHistoricalIdentityTests(db: PrismaClient, options: { mode: "plan" | "resolve" | "undo"; resolutionAt?: string }) {
  const resolutionAt = options.resolutionAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(resolutionAt)) || new Date(resolutionAt).toISOString() !== resolutionAt) throw new Error("invalid_resolution_timestamp");
  return db.$transaction(async tx => {
    if (options.mode === "plan") await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const rows = await tx.$queryRawUnsafe<HistoricalJob[]>(
      `select "id", "jobType", "status", "idempotencyKey", "payload", "attempts", "maxAttempts", "queuedAt", "deadLetteredAt", "cancelledAt"
       from "IdentityJob" where "id"=any($1::text[]) order by "id"${options.mode === "plan" ? "" : " for update"}`,
      [...HISTORICAL_TEST_IDS],
    );
    if (rows.length !== HISTORICAL_TEST_IDS.length || new Set(rows.map(row => row.id)).size !== HISTORICAL_TEST_IDS.length) throw new Error("historical_test_inventory_mismatch");
    for (const row of rows) {
      const queuedAt = new Date(row.queuedAt).toISOString();
      const deadLetteredAt = new Date(row.deadLetteredAt).toISOString();
      if (!(HISTORICAL_TEST_IDS as readonly string[]).includes(row.id) || row.jobType !== "email_delivery"
        || !row.idempotencyKey.startsWith("production-email-test:")
        || row.payload.purpose !== "account_email_verification"
        || row.payload.subject !== "Direct Democracy production email delivery test"
        || row.payload.text !== "This is a Direct Democracy production email delivery test. The generated audit contains no one-time token or provider secret."
        || row.attempts !== 1 || row.maxAttempts !== 1 || !queuedAt.startsWith("2026-06-24T") || !deadLetteredAt.startsWith("2026-06-24T")) throw new Error("historical_test_evidence_mismatch");
      if (options.mode === "undo") {
        if (row.status !== "cancelled" || !row.cancelledAt || new Date(row.cancelledAt).toISOString() !== resolutionAt) throw new Error("historical_test_undo_state_mismatch");
      } else if (row.status !== "dead_lettered" || row.cancelledAt !== null) throw new Error("historical_test_resolution_state_mismatch");
    }
    if (options.mode === "undo") {
      const events = await tx.$queryRawUnsafe<Array<{ id: string; summary: string }>>(
        `select "id", "summary" from "IdentityJobEvent" where "id"=any($1::text[]) and "eventType"='historical_test_resolved'`,
        rows.map(row => eventId(row.id)),
      );
      if (events.length !== rows.length || events.some(event => event.summary !== `${HISTORICAL_TEST_REASON} Resolution: ${resolutionAt}`)) throw new Error("historical_test_undo_event_mismatch");
    }
    if (options.mode !== "plan") {
      const changed = await tx.$executeRawUnsafe(
        options.mode === "undo"
          ? `update "IdentityJob" set "status"='dead_lettered', "cancelledAt"=null where "id"=any($1::text[]) and "status"='cancelled' and "cancelledAt"=$2::timestamptz`
          : `update "IdentityJob" set "status"='cancelled', "cancelledAt"=$2::timestamptz where "id"=any($1::text[]) and "status"='dead_lettered' and "cancelledAt" is null`,
        [...HISTORICAL_TEST_IDS], resolutionAt,
      );
      if (changed !== HISTORICAL_TEST_IDS.length) throw new Error("historical_test_resolution_update_mismatch");
      for (const row of rows) await tx.$executeRawUnsafe(
        `insert into "IdentityJobEvent" ("id", "jobId", "eventType", "summary") values ($1,$2,$3,$4)`,
        options.mode === "undo" ? `${eventId(row.id)}_reverted` : eventId(row.id), row.id,
        options.mode === "undo" ? "historical_test_resolution_reverted" : "historical_test_resolved",
        options.mode === "undo" ? `Restored original dead-letter status; no resend. Resolution: ${resolutionAt}` : `${HISTORICAL_TEST_REASON} Resolution: ${resolutionAt}`,
      );
    }
    return {
      mode: options.mode, ids: [...HISTORICAL_TEST_IDS], resolutionAt, reason: HISTORICAL_TEST_REASON,
      changed: options.mode === "plan" ? 0 : rows.length, providerErrorsAndHistoryPreserved: true, emailsSent: 0,
      undoCommand: `node --import tsx scripts/resolve-historical-identity-tests.ts --undo --resolution-at=${resolutionAt}`,
    };
  }, { maxWait: 5000, timeout: 10000 });
}

async function main() {
  await import("../lib/env/load-local-env");
  const { PrismaClient } = await import("@prisma/client");
  const flags = process.argv.slice(2);
  if (flags.some(flag => flag !== "--apply" && flag !== "--undo" && !flag.startsWith("--resolution-at=")) || flags.includes("--apply") && flags.includes("--undo")) throw new Error("invalid_resolution_arguments");
  const resolutionAt = flags.find(flag => flag.startsWith("--resolution-at="))?.slice("--resolution-at=".length);
  if (flags.includes("--undo") && !resolutionAt) throw new Error("undo_requires_resolution_timestamp");
  const db = new PrismaClient({ log: [] });
  try {
    const receipt = await resolveHistoricalIdentityTests(db, { mode: flags.includes("--undo") ? "undo" : flags.includes("--apply") ? "resolve" : "plan", resolutionAt });
    if (receipt.mode !== "plan") {
      const directory = path.join(process.cwd(), ".local/identity-worker-resolution");
      mkdirSync(directory, { recursive: true });
      writeFileSync(path.join(directory, `${receipt.resolutionAt.replaceAll(":", "-")}-${receipt.mode}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
    }
    console.log(JSON.stringify(receipt, null, 2));
  } finally { await db.$disconnect(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  // Never print database/provider payloads on a failed conditional resolution.
  console.error("Historical identity test resolution failed; no retry or send was attempted. Inspect the guarded state before retrying.");
  process.exitCode = 1;
});
