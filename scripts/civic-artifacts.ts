import "@/lib/env/load-local-env";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { REQUIRED_RELEASE_FILES, civicManifestId, validateManifest, type CivicManifest } from "@/lib/dataops/artifact-policy";
import { describeArtifacts, existingArtifactObjects, mapBounded, readManifest, restoreManifest, saveManifest, selectArtifactPaths, uploadArtifact } from "@/lib/dataops/blob-checkpoint";

const root = process.cwd();
const mode = process.argv[2];
const option = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const localManifestPath = path.join(root, ".local/civic-release-candidate.json");
function json<T>(name: string, directory = root): T { return JSON.parse(readFileSync(path.join(directory, "data/generated", name), "utf8")) as T; }
function count(value: unknown): number { return Array.isArray(value) ? value.length : 0; }

type RecordData = Record<string, unknown>;
function recordArray(value: unknown, name: string): RecordData[] {
  if (!Array.isArray(value) || value.some(row => !row || typeof row !== "object" || Array.isArray(row))) throw new Error(`release_invalid_dataset_shape:${name}`);
  return value;
}
function identitySet(rows: RecordData[], label: string) {
  const ids = rows.map(row => row.id);
  if (ids.some(id => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) throw new Error(`release_invalid_identity:${label}`);
  return new Set(ids as string[]);
}
function generationEvidence(directory: string, now: number) {
  const names = ["meetings-pipeline-run.json", "meetings-pipeline-targeted-run.json", "dataops-pipeline-run.json", "dataops-pipeline-targeted-run.json"];
  const reports = names.flatMap(name => {
    if (!existsSync(path.join(directory, "data/generated", name))) return [];
    const value = json<{ runId?: string; startedAt?: string; completedAt?: string; stages?: Array<{ status?: string; commands?: Array<{ command?: string[]; status?: string }> }> }>(name, directory);
    const started = Date.parse(value.startedAt ?? "");
    const completed = Date.parse(value.completedAt ?? "");
    const complete = Number.isFinite(completed) && completed >= started && completed <= now + 5 * 60_000;
    return Number.isFinite(started) && now - started <= 24 * 60 * 60_000 && started <= now + 5 * 60_000 ? [{ ...value, started, complete }] : [];
  }).sort((a, b) => a.started - b.started);
  const commands = new Map<string, string>();
  const invocations = new Map<string, { script: string; status: string }>();
  let latestCompleted = -Infinity;
  for (const report of reports) {
    if (!report.complete) continue;
    latestCompleted = Math.max(latestCompleted, report.started);
    for (const stage of report.stages ?? []) for (const command of stage.commands ?? []) {
      const scriptIndex = command.command?.findIndex(part => /^scripts\/.*\.(?:ts|mjs)$/.test(part)) ?? -1;
      if (scriptIndex < 0 || !command.command) continue;
      const script = command.command[scriptIndex];
      const status = command.status ?? "unknown";
      commands.set(script, status);
      // A successful default pass cannot erase a failed minutes-only pass.
      // Ignore the TS launcher, but require the same script and arguments for
      // a later completed retry to recover an earlier failed invocation.
      invocations.set(JSON.stringify(command.command.slice(scriptIndex)), { script, status });
    }
  }
  if (reports.some(report => report.started > latestCompleted && !report.complete)) throw new Error("release_collection_run_incomplete");
  for (const script of ["scripts/publish-public-meeting-runtime.ts", "scripts/generate-voting-cards.ts", "scripts/generate-issue-hubs.ts"]) {
    if (commands.get(script) !== "succeeded") throw new Error(`release_core_generation_not_verified:${path.basename(script)}`);
  }
  for (const { script, status } of invocations.values()) {
    const core = /^scripts\/(?:generate-|regenerate-|publish-|reprocess-|import-|public-meetings-import)/.test(script);
    const integrity = /scripts\/audit-nevada-(?:financial-coverage|political-ads)\.ts$/.test(script);
    if ((core || integrity) && status !== "succeeded") throw new Error(`release_core_generation_failed:${path.basename(script)}`);
  }
}

export function releaseGateAt(directory = root, options: { at?: number; historical?: boolean } = {}) {
  const now = options.at ?? Date.now();
  if (!options.historical && existsSync(path.join(directory, "data/generated/.dataops-pipeline.lock"))) throw new Error("release_collector_is_active");
  for (const file of REQUIRED_RELEASE_FILES) if (!existsSync(path.join(directory, file))) throw new Error(`release_file_missing:${file}`);
  const integrity = json<{ generatedAt: string; launchReady: boolean; totals: { critical: number } }>("public-site-integrity-audit.json", directory);
  const audited = Date.parse(integrity.generatedAt);
  if (!integrity.totals || integrity.totals.critical !== 0 || typeof integrity.launchReady !== "boolean" || !Number.isFinite(audited) || now - audited > 24 * 60 * 60_000 || audited > now + 5 * 60_000) throw new Error("release_integrity_audit_missing_stale_or_critical");
  generationEvidence(directory, now);
  const events = recordArray(json("events-runtime.json", directory), "events");
  const eventIds = identitySet(events, "events");
  const eventCanonical = new Map([...eventIds].map(id => [id, id]));
  for (const event of events) {
    if (event.meeting_alias_ids !== undefined && (!Array.isArray(event.meeting_alias_ids) || event.meeting_alias_ids.some(id => typeof id !== "string" || !id))) throw new Error("release_invalid_meeting_alias");
    for (const alias of (event.meeting_alias_ids ?? []) as string[]) {
      if (eventCanonical.has(alias) && eventCanonical.get(alias) !== event.id) throw new Error("release_ambiguous_meeting_alias");
      eventCanonical.set(alias, event.id as string);
    }
  }
  const topics = recordArray(json("public-meeting-items-runtime.json", directory), "meeting_topics");
  const topicIds = identitySet(topics, "meeting_topics");
  const topicMeeting = new Map(topics.map(topic => [topic.id, eventCanonical.get(String(topic.meeting_id))]));
  for (const topic of topics) if (!eventCanonical.has(String(topic.meeting_id))) throw new Error("release_topic_missing_meeting");
  const cards = recordArray(json("voting-cards-runtime.json", directory), "voting_questions");
  identitySet(cards, "voting_questions");
  for (const card of cards) {
    if (!eventCanonical.has(String(card.meeting_id))) throw new Error("release_question_missing_meeting");
    if (!card.topic_item_id || !topicIds.has(String(card.topic_item_id)) || topicMeeting.get(card.topic_item_id) !== eventCanonical.get(String(card.meeting_id))) throw new Error("release_question_invalid_topic_reference");
  }
  const decisions = recordArray(json<{ records?: unknown }>("voting-cards.json", directory).records, "decisions");
  identitySet(decisions, "decisions");
  for (const decision of decisions) if (decision.meetingId && !eventCanonical.has(String(decision.meetingId))) throw new Error("release_decision_missing_meeting");
  const issues = recordArray(json<{ records?: unknown }>("issues-runtime.json", directory).records, "issues");
  identitySet(issues, "issues");
  for (const issue of issues) if (issue.relatedMeetingIds !== undefined && (!Array.isArray(issue.relatedMeetingIds) || issue.relatedMeetingIds.some(id => !eventCanonical.has(String(id))))) throw new Error("release_issue_missing_meeting");
  const finance = recordArray(json<{ records?: unknown }>("nevada-financial-coverage.json", directory).records, "finance");
  const financialIds = finance.map(row => `${row.entityType}:${row.entityId}`);
  if (finance.some(row => !["candidate", "official"].includes(String(row.entityType)) || typeof row.entityId !== "string" || !row.entityId) || new Set(financialIds).size !== financialIds.length) throw new Error("release_invalid_finance_identity");
  for (const row of finance) {
    const campaign = row.campaignFinance as { snapshot?: { totalRaised?: unknown; totalSpent?: unknown; cashOnHand?: unknown } } | undefined;
    const snapshot = campaign?.snapshot;
    if (snapshot && ([snapshot.totalRaised, snapshot.totalSpent].some(value => typeof value !== "number" || !Number.isFinite(value)) || (snapshot.cashOnHand != null && (typeof snapshot.cashOnHand !== "number" || !Number.isFinite(snapshot.cashOnHand))))) throw new Error("release_invalid_financial_amount");
  }
  const ads = recordArray(json<{ ads?: unknown }>("nevada-political-ads.json", directory).ads, "ads");
  identitySet(ads, "ads");
  const organizations = recordArray(json<{ records?: unknown }>("nevada-public-organizations.json", directory).records, "organizations");
  identitySet(organizations, "organizations");
  const current = { meetings: events.length, meetingTopics: topics.length, votingQuestions: cards.length, decisions: decisions.length, issues: issues.length, financialEntities: finance.length, adFilings: ads.length, organizations: organizations.length };
  if (Object.values(current).some(value => value === 0)) throw new Error("release_empty_core_dataset");
  return { metrics: current, coverageComplete: integrity.launchReady === true };
}

function metrics() {
  return { meetings: count(json("events-runtime.json")), meetingTopics: count(json("public-meeting-items-runtime.json")), votingQuestions: count(json("voting-cards-runtime.json")), financialEntities: count(json<{ records?: unknown[] }>("nevada-financial-coverage.json").records), adFilings: count(json<{ ads?: unknown[] }>("nevada-political-ads.json").ads) };
}

async function candidate(kind: CivicManifest["kind"]): Promise<CivicManifest> {
  if (existsSync(path.join(root, "data/generated/.dataops-pipeline.lock"))) throw new Error("wait_for_active_collector_before_snapshot");
  const files = await describeArtifacts(root, await selectArtifactPaths(root, kind));
  const sourceCommit = process.env.GITHUB_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const sourceDirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal", "--", "lib", "scripts", "app", "components", "types", "data/seed", ".github", "proxy.ts", "middleware.ts", ".vercelignore", "package.json", "package-lock.json", "next.config.ts", "vercel.json"], { encoding: "utf8" }).trim().length > 0;
  const state = kind === "release" ? releaseGateAt() : { metrics: metrics(), coverageComplete: false };
  const value = { schemaVersion: 1 as const, kind, createdAt: new Date().toISOString(), sourceCommit, sourceDirty, files, ...state };
  return validateManifest({ ...value, id: civicManifestId(value) }, kind);
}

async function upload(manifest: CivicManifest) {
  const inventory = await existingArtifactObjects();
  const uploading = new Map<string, Promise<Awaited<ReturnType<typeof uploadArtifact>>>>();
  let complete = 0;
  const files = await mapBounded(manifest.files, 4, async (entry) => {
    let pending = uploading.get(entry.sha256);
    if (!pending) { pending = uploadArtifact(root, entry, inventory); uploading.set(entry.sha256, pending); }
    const stored = await pending;
    const result = { ...entry, objectKey: stored.objectKey };
    complete++;
    if (complete % 100 === 0) console.log(`Verified ${complete}/${manifest.files.length} durable civic artifacts.`);
    return result;
  });
  // A concurrent collector cannot publish a mixture of two snapshots.
  const checked = await describeArtifacts(root, manifest.files.map((entry) => entry.path));
  if (checked.some((entry, index) => entry.sha256 !== manifest.files[index].sha256)) throw new Error("civic_snapshot_changed_during_upload");
  const stored = { ...manifest, files, id: civicManifestId({ ...manifest, files }) };
  await saveManifest(stored);
  return stored;
}

function requireDeployHook() {
  const hook = process.env.CIVIC_DATA_DEPLOY_HOOK;
  if (!hook || !/^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\//.test(hook)) throw new Error("civic_data_deploy_hook_unconfigured");
  return hook;
}
async function writeLocalManifest(manifest: CivicManifest) {
  const temporary = `${localManifestPath}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(manifest, null, 2));
  await rename(temporary, localManifestPath);
}

async function main() {
  await mkdir(path.join(root, ".local"), { recursive: true });
  if (mode === "prepare") {
    const manifest = await candidate("release");
    await writeLocalManifest(manifest);
    console.log(JSON.stringify({ id: manifest.id, status: "prepared_not_published", files: manifest.files.length, bytes: manifest.files.reduce((sum, row) => sum + row.bytes, 0), metrics: manifest.metrics, coverageComplete: manifest.coverageComplete }));
    return;
  }
  if (mode === "checkpoint") {
    if (existsSync(path.join(root, "data/generated/.dataops-pipeline.lock"))) throw new Error("wait_for_active_collector_before_checkpoint");
    const manifest = await candidate("worker");
    if (process.argv.includes("--dry-run")) { console.log(JSON.stringify({ id: manifest.id, files: manifest.files.length, bytes: manifest.files.reduce((sum, row) => sum + row.bytes, 0) })); return; }
    const stored = await upload(manifest);
    console.log(JSON.stringify({ status: "worker_checkpoint_saved", id: stored.id, files: stored.files.length }));
    return;
  }
  if (mode === "restore-worker" || mode === "restore-release") {
    if (mode === "restore-release" && process.env.CIVIC_DATA_RELEASE_ENABLED !== "true" && !process.argv.includes("--required")) { console.log("Civic data release overlay disabled; using packaged artifacts."); return; }
    const kind = mode === "restore-worker" ? "worker" : "release";
    const manifest = await readManifest(kind, option("id") ?? (kind === "release" ? process.env.CIVIC_DATA_RELEASE_ID : undefined) ?? "latest");
    if (!manifest) {
      if (kind === "worker" && process.argv.includes("--allow-empty")) { console.log("No prior worker checkpoint; initializing from repository artifacts."); return; }
      throw new Error(`missing_${kind}_manifest`);
    }
    const result = await restoreManifest(root, manifest);
    if (kind === "release") await writeFile(path.join(root, "data/generated/civic-data-release.json"), JSON.stringify({ id: manifest.id, createdAt: manifest.createdAt, sourceCommit: manifest.sourceCommit, metrics: manifest.metrics, coverageComplete: manifest.coverageComplete }));
    else await rm(path.join(root, "data/generated/civic-data-release.json"), { force: true });
    console.log(JSON.stringify({ status: `${kind}_restored`, ...result }));
    return;
  }
  if (mode === "publish") {
    const automated = process.argv.includes("--automation") && process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_REF === "refs/heads/main" && ["schedule", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "");
    if (!automated && !process.argv.includes("--approve")) throw new Error("release_requires_approval_or_trusted_scheduled_worker");
    const manifest = validateManifest(JSON.parse(readFileSync(localManifestPath, "utf8")) as CivicManifest, "release");
    const verified = releaseGateAt();
    if (JSON.stringify(verified.metrics) !== JSON.stringify(manifest.metrics) || verified.coverageComplete !== manifest.coverageComplete) throw new Error("prepared_release_metadata_changed");
    if (process.argv.includes("--trigger-deploy")) requireDeployHook();
    const previous = await readManifest("release");
    if (previous) for (const [name, value] of Object.entries(previous.metrics)) if (value > 0 && (manifest.metrics[name] ?? 0) < value * 0.8) throw new Error(`release_unexpected_record_loss:${name}`);
    const stored = await upload(manifest);
    await writeLocalManifest(stored);
    console.log(JSON.stringify({ status: "release_published_to_storage", id: stored.id, metrics: stored.metrics, coverageComplete: stored.coverageComplete }));
    if (process.argv.includes("--trigger-deploy")) {
      const hook = requireDeployHook();
      const response = await fetch(hook, { method: "POST", signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`deployment_trigger_failed:${response.status}`);
      console.log("Deployment triggered; verify the public release ID before reporting live success.");
    }
    return;
  }
  if (mode === "rollback") {
    if (!process.argv.includes("--approve")) throw new Error("rollback_requires_explicit_approval");
    const id = option("id");
    if (!id || !/^[a-f0-9]{64}$/.test(id)) throw new Error("rollback_requires_versioned_release_id");
    if (process.argv.includes("--trigger-deploy")) requireDeployHook();
    const prior = await readManifest("release", id);
    if (!prior) throw new Error("rollback_release_not_found");
    const temporary = await mkdtemp(path.join(os.tmpdir(), "civic-rollback-validation-"));
    try {
      await restoreManifest(temporary, prior);
      const verified = releaseGateAt(temporary, { at: Date.parse(prior.createdAt), historical: true });
      if (JSON.stringify(verified.metrics) !== JSON.stringify(prior.metrics) || verified.coverageComplete !== prior.coverageComplete) throw new Error("rollback_release_metadata_invalid");
      await saveManifest(prior, undefined, undefined, { rollback: true });
      await writeLocalManifest(prior);
    } finally { await rm(temporary, { recursive: true, force: true }); }
    console.log(JSON.stringify({ status: "release_rollback_published_to_storage", id: prior.id, sourceCommit: prior.sourceCommit }));
    if (process.argv.includes("--trigger-deploy")) {
      const response = await fetch(requireDeployHook(), { method: "POST", signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`deployment_trigger_failed:${response.status}`);
      console.log("Rollback deployment triggered; verify the live release ID before reporting success.");
    }
    return;
  }
  if (mode === "verify-live") {
    const base = option("url") ?? process.env.DIRECT_DEMOCRACY_PUBLIC_URL;
    if (!base || !/^https:\/\//.test(base)) throw new Error("live_https_url_required");
    const expected = option("id") ?? JSON.parse(readFileSync(localManifestPath, "utf8")).id;
    const response = await fetch(new URL("/api/data-release", base), { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    const actual = await response.json() as { id?: string };
    if (!response.ok || actual.id !== expected) throw new Error("live_release_not_yet_verified");
    console.log(JSON.stringify({ status: "live_release_verified", id: actual.id, url: new URL("/api/data-release", base).href }));
    return;
  }
  throw new Error("Usage: civic-artifacts.ts prepare|publish [--approve|--automation] [--trigger-deploy]|rollback --id=HASH --approve [--trigger-deploy]|checkpoint [--dry-run]|restore-worker|restore-release|verify-live");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((error) => {
  // Provider error objects can contain request details; only expose our bounded
  // error classifications, never credentials or signed request URLs.
  const message = error instanceof Error ? error.message : "unknown_error";
  console.error(message.replace(/https?:\/\/\S+/g, "[provider_url]").replace(/(?:token|key|secret|password)=[^\s&]+/gi, "credential=[redacted]").slice(0, 500));
  process.exitCode = 1;
});
