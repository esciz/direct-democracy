import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";

import { createPrivateBetaInviteAction, updatePrivateBetaInviteAction } from "@/app/admin/private-beta/actions";
import { PageIntro } from "@/components/ui/page-intro";
import { PRIVATE_BETA_INVITE_PRIORITIES, PRIVATE_BETA_INVITE_STATUSES, getPrivateBetaInviteSummary, listPrivateBetaInvites } from "@/lib/private-beta/invites";

type LaunchControlReport = {
  generatedAt?: string;
  status?: string;
  recommendation?: string;
  app?: {
    baseUrl?: string | null;
    inviteUrl?: string | null;
    privateBetaUrl?: string | null;
    authUrl?: string | null;
    adminLaunchControlUrl?: string | null;
  };
  validation?: Record<string, boolean>;
  blockers?: string[];
  warnings?: string[];
  readiness?: { status?: string; blockers?: string[]; warnings?: string[]; totals?: Record<string, unknown> };
  feedback?: { status?: string; totals?: Record<string, unknown> };
  inviteChecklist?: string[];
};

type LiveSmokeReport = {
  generatedAt?: string;
  status?: string;
  baseUrl?: string | null;
  totals?: {
    routesChecked?: number;
    passed?: number;
    warnings?: number;
    failures?: number;
  };
  results?: Array<{
    path: string;
    label: string;
    status: number | null;
    location: string | null;
    xRobotsTag: string | null;
    ok: boolean;
    warning: boolean;
    reason: string;
  }>;
  warnings?: string[];
  failures?: string[];
};

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");

function readGenerated<T>(fileName: string, fallback: T): T {
  const filePath = path.join(GENERATED_DIR, fileName);
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function toneForStatus(status: string | undefined) {
  if (status === "ready_to_share_privately" || status === "ready_for_private_link_sharing") return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
  if (status === "ready_with_warnings") return "border-amber-300/20 bg-amber-500/10 text-amber-100";
  return "border-rose-300/20 bg-rose-500/10 text-rose-100";
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(value: string | undefined) {
  if (!value) return "Not generated";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not generated" : date.toLocaleString();
}

export default async function AdminPrivateBetaLaunchPage() {
  const report = readGenerated<LaunchControlReport>("private-beta-launch-control.json", {});
  const liveSmoke = readGenerated<LiveSmokeReport>("private-beta-live-smoke.json", {});
  const inviteSummary = getPrivateBetaInviteSummary();
  const invites = listPrivateBetaInvites();
  const validation = report.validation ?? {};
  const checklist = report.inviteChecklist ?? [
    "Run npm run private-beta:launch-audit.",
    "Push the latest commits to origin.",
    "Wait for Vercel production deploy to finish.",
    "Open the main invite URL in an incognito window.",
    "Submit a feedback report and confirm it appears in admin review.",
  ];
  const inviteUrl = report.app?.inviteUrl ?? report.app?.baseUrl ?? "/";
  const testerGuideUrl = report.app?.privateBetaUrl ?? "/private-beta";

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Private beta launch control"
        description="Use this before sending the link to a tester. It keeps the beta private, auth-gated, no-indexed, and connected to the feedback review loop."
        meta={
          <>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${toneForStatus(report.status)}`}>
              {formatLabel(report.status ?? "launch audit missing")}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
              Generated {formatDate(report.generatedAt)}
            </span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/private-beta-feedback" className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30">
              Feedback queue
            </Link>
            <Link href="/admin/operations" className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30">
              Operations
            </Link>
          </div>
        }
      />

      <section className={`rounded-[1.75rem] border p-5 shadow-card sm:p-6 ${toneForStatus(report.status)}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">Recommendation</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{report.recommendation ?? "Run npm run private-beta:launch-audit before sharing."}</h2>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-card sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Invite Link</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Send people to the main site</h2>
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="break-all font-mono text-sm text-cyan-100">{inviteUrl}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={inviteUrl} className="rounded-full bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
              Open invite link
            </a>
            <a href={testerGuideUrl} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30">
              Optional tester guide
            </a>
            <a href={report.app?.authUrl ?? "/auth"} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30">
              Open auth
            </a>
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Invite copy</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              I am privately testing Direct Democracy before public launch. Use this link, create or sign into your account, try the normal site flow, and send feedback if anything breaks or feels confusing.
            </p>
          </div>
          <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Optional tester guide</p>
            <p className="mt-2 break-all font-mono text-xs text-cyan-100">{testerGuideUrl}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Keep this as a helper page for guided testers. The main invite should still be the homepage so people experience the real entry flow.
            </p>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-card sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Before Sending</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Operator checklist</h2>
          <ol className="mt-5 space-y-3">
            {checklist.map((item, index) => (
              <li key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3 text-sm leading-6 text-slate-300">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-xs font-bold text-slate-950">{index + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Invite Tracker</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Private tester list</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Track who you personally invited and what still needs follow-up. This stays in `data/private` and is not published.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
              {inviteSummary.total} testers
            </span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100">
              {inviteSummary.accepted} accepted
            </span>
            <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
              {inviteSummary.invited} invited
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <form action={createPrivateBetaInviteAction} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Add tester</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300">
                Name
                <input name="testerName" required className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="Jane Tester" />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Email
                <input name="testerEmail" type="email" required className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="person@example.com" />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Relationship
                <input name="relationship" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="friend, civic contact, tester" />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Priority
                <select name="priority" defaultValue="normal" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100">
                  {PRIVATE_BETA_INVITE_PRIORITIES.map((priority) => (
                    <option key={priority.value} value={priority.value}>{priority.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-3 grid gap-2 text-sm text-slate-300">
              Notes
              <textarea name="notes" rows={4} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="What should this tester focus on?" />
            </label>
            <button className="mt-4 rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">Add tester</button>
          </form>

          <div className="space-y-3">
            {invites.length ? (
              invites.slice(0, 20).map((invite) => (
                <article key={invite.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                          {invite.status.replaceAll("_", " ")}
                        </span>
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-100">
                          {invite.priority}
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-slate-50">{invite.testerName}</h3>
                      <p className="mt-1 text-sm text-slate-400">{invite.testerEmail}</p>
                      {invite.relationship ? <p className="mt-1 text-xs text-slate-500">{invite.relationship}</p> : null}
                    </div>
                    <p className="text-xs text-slate-500">Updated {formatDate(invite.updatedAt)}</p>
                  </div>
                  {invite.notes ? <p className="mt-3 text-sm leading-6 text-slate-400">{invite.notes}</p> : null}
                  <form action={updatePrivateBetaInviteAction} className="mt-4 grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)_auto]">
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <select name="status" defaultValue={invite.status} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100">
                      {PRIVATE_BETA_INVITE_STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                    <input name="notes" defaultValue={invite.notes ?? ""} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="Follow-up note" />
                    <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100">Update</button>
                  </form>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-400">
                No testers tracked yet. Add the first person before you send a link.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Gate Review</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Launch-control checks</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-rose-100">
              {report.blockers?.length ?? 0} blockers
            </span>
            <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
              {report.warnings?.length ?? 0} warnings
            </span>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(validation).map(([key, value]) => (
            <div key={key} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{formatLabel(key)}</p>
              <p className={`mt-2 text-sm font-semibold ${value ? "text-emerald-200" : "text-rose-200"}`}>{value ? "Passing" : "Needs attention"}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Live Domain Smoke</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{formatLabel(liveSmoke.status ?? "not run")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Run `npm run private-beta:live-smoke` after Vercel deploys to verify the public domain, auth redirects, noindex headers, robots.txt, and demo-name leakage.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100">
              {liveSmoke.totals?.passed ?? 0} passed
            </span>
            <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
              {liveSmoke.totals?.warnings ?? 0} warnings
            </span>
            <span className="rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-rose-100">
              {liveSmoke.totals?.failures ?? 0} failures
            </span>
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {(liveSmoke.results ?? []).length ? (
            liveSmoke.results?.map((result) => (
              <article key={result.path} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">{result.label}</h3>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${result.ok ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100" : result.warning ? "border-amber-300/20 bg-amber-500/10 text-amber-100" : "border-rose-300/20 bg-rose-500/10 text-rose-100"}`}>
                    {result.ok ? "pass" : result.warning ? "warning" : "fail"}
                  </span>
                </div>
                <p className="mt-2 font-mono text-xs text-cyan-100">{result.path}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{result.reason}</p>
                <p className="mt-2 text-xs text-slate-500">HTTP {result.status ?? "none"} · {result.xRobotsTag ?? "no x-robots header"}</p>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-400">
              No live smoke results yet.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-card sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Readiness</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{formatLabel(report.readiness?.status ?? "missing")}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Private readiness blockers: {report.readiness?.blockers?.length ?? 0}. Warnings: {report.readiness?.warnings?.length ?? 0}.
          </p>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-card sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Feedback Loop</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{formatLabel(report.feedback?.status ?? "missing")}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Records: {String(report.feedback?.totals?.records ?? 0)}. Open: {String(report.feedback?.totals?.open ?? 0)}. Public updates: {String(report.feedback?.totals?.publicUpdates ?? 0)}.
          </p>
        </div>
      </section>
    </div>
  );
}
