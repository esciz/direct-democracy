import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";

type LaunchControlReport = {
  generatedAt?: string;
  status?: string;
  recommendation?: string;
  app?: {
    baseUrl?: string | null;
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
  const validation = report.validation ?? {};
  const checklist = report.inviteChecklist ?? [
    "Run npm run private-beta:launch-audit.",
    "Push the latest commits to origin.",
    "Wait for Vercel production deploy to finish.",
    "Open the private beta URL in an incognito window.",
    "Submit a feedback report and confirm it appears in admin review.",
  ];
  const privateBetaUrl = report.app?.privateBetaUrl ?? "/private-beta";

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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Tester Link</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Send people to the Beta Hub</h2>
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="break-all font-mono text-sm text-cyan-100">{privateBetaUrl}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={privateBetaUrl} className="rounded-full bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
              Open beta link
            </a>
            <a href={report.app?.authUrl ?? "/auth"} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30">
              Open auth
            </a>
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Invite copy</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              I am privately testing Direct Democracy before public launch. Use this link, create or sign into your account, try the suggested beta pass, and send feedback from the Beta Hub if anything breaks or feels confusing.
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
