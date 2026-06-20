import Link from "next/link";
import fs from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";

import { CivicRecordReviewStatus } from "@prisma/client";

import { PageIntro } from "@/components/ui/page-intro";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

const COURT_CASE_MANIFEST_PATH = path.join(process.cwd(), "data/manual-sources/court-cases/reviewed-public-cases/manifest.json");
const COURT_CASE_REPORT_PATH = path.join(process.cwd(), "data/generated/public-court-cases-report.json");

type CourtCaseManifestRecord = {
  id?: string;
  caption?: string | null;
  caseNumber?: string | null;
  courtName?: string | null;
  sourceUrl?: string | null;
  sourceFile?: string | null;
  reviewStatus?: string | null;
  publicVisibilityStatus?: string | null;
  exclusionReason?: string | null;
  notes?: string | null;
};

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value) : "Not checked";
}

function StatusBadge({ value }: { value: string }) {
  return <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">{value.replaceAll("_", " ")}</span>;
}

export default async function CasesDataFactoryPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") {
    redirect("/profile");
  }

  const [sources, recentRuns, pendingCases, privacyWarnings, pendingDocuments, duplicateCaseNumbers, staleCases, manifest, runtimeReport] = await Promise.all([
    prisma.courtJurisdiction.findMany({
      include: { source: true, _count: { select: { cases: true } } },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    }),
    prisma.sourceSyncRun.findMany({
      where: { source: { dataCategory: "court_cases" } },
      include: { source: { select: { name: true, url: true } } },
      orderBy: { startedAt: "desc" },
      take: 12,
    }),
    prisma.courtCase.findMany({
      where: { reviewStatus: CivicRecordReviewStatus.pending_review },
      include: { courtJurisdiction: true },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.courtCase.findMany({
      where: { publicVisibilityStatus: { not: "public" } },
      include: { courtJurisdiction: true },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.courtDocument.findMany({
      where: { reviewStatus: CivicRecordReviewStatus.pending_review },
      include: { case: { select: { caption: true, caseNumber: true } } },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.courtCase.groupBy({
      by: ["caseNumber"],
      _count: { _all: true },
      having: { caseNumber: { _count: { gt: 1 } } },
      orderBy: { caseNumber: "asc" },
      take: 25,
    }),
    prisma.courtCase.findMany({
      where: {
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) } }],
      },
      include: { courtJurisdiction: true },
      orderBy: { lastCheckedAt: "asc" },
      take: 25,
    }),
    readJsonFile<{ records?: CourtCaseManifestRecord[] }>(COURT_CASE_MANIFEST_PATH, { records: [] }),
    readJsonFile<{ counts?: Record<string, number>; runtimePath?: string; exclusions?: Array<Record<string, unknown>> }>(COURT_CASE_REPORT_PATH, {}),
  ]);
  const manifestRecords = Array.isArray(manifest.records) ? manifest.records : [];

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin · Data Factory"
        title="Court cases"
        description="Review court sources, public case imports, privacy warnings, duplicates, stale checks, and court documents before anything appears publicly."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/data-factory" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Data Factory
            </Link>
            <Link href="/cases" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Public cases
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Court sources", sources.length],
          ["Import runs", recentRuns.length],
          ["Pending cases", pendingCases.length],
          ["Privacy warnings", privacyWarnings.length],
          ["Pending documents", pendingDocuments.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-50">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Reviewed public manifest lane</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Manual source records must be reviewed as public before they are written to the public court-case runtime.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={`${manifestRecords.length} manifest rows`} />
            <StatusBadge value={`${runtimeReport.counts?.reviewedPublic ?? 0} public runtime`} />
            <StatusBadge value={`${runtimeReport.counts?.excluded ?? 0} excluded`} />
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {manifestRecords.slice(0, 8).map((record) => (
            <div key={record.id ?? record.caseNumber ?? record.caption} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{record.caption ?? "Caption pending"}</p>
                  <p className="mt-1 text-xs text-slate-500">{record.courtName ?? "Court pending"} · {record.caseNumber ?? "Case number pending"}</p>
                </div>
                <StatusBadge value={`${record.reviewStatus ?? "needs_review"} / ${record.publicVisibilityStatus ?? "visibility_pending"}`} />
              </div>
              {record.exclusionReason ? <p className="mt-3 text-xs font-semibold text-amber-200">Excluded: {record.exclusionReason}</p> : null}
              {record.notes ? <p className="mt-3 text-sm leading-6 text-slate-400">{record.notes}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                {record.sourceUrl ? (
                  <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="break-all text-cyan-200">
                    Official source
                  </a>
                ) : null}
                {record.sourceFile ? <span className="text-slate-500">Local file: {record.sourceFile}</span> : null}
              </div>
            </div>
          ))}
          {!manifestRecords.length ? <p className="text-sm text-slate-400">No reviewed public manifest rows yet.</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-slate-50">Court sources</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sources.map((source) => (
            <div key={source.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-100">{source.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{source.level} · {source.accessMethod}</p>
                </div>
                <StatusBadge value={`${source._count.cases} cases`} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{source.notes ?? "No notes."}</p>
              <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex break-all text-xs font-semibold text-cyan-200">
                {source.sourceUrl}
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Pending review</h2>
          <div className="mt-4 space-y-3">
            {pendingCases.map((courtCase) => (
              <div key={courtCase.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold text-slate-100">{courtCase.caption}</p>
                <p className="mt-1 text-xs text-slate-500">{courtCase.courtJurisdiction.name} · {courtCase.caseNumber}</p>
              </div>
            ))}
            {!pendingCases.length ? <p className="text-sm text-slate-400">No pending cases.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Privacy review warnings</h2>
          <div className="mt-4 space-y-3">
            {privacyWarnings.map((courtCase) => (
              <div key={courtCase.id} className="rounded-2xl border border-amber-300/18 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold text-amber-50">{courtCase.caption}</p>
                <p className="mt-1 text-xs text-amber-100/70">{courtCase.publicVisibilityStatus.replaceAll("_", " ")} · {courtCase.courtJurisdiction.name}</p>
              </div>
            ))}
            {!privacyWarnings.length ? <p className="text-sm text-slate-400">No privacy warnings.</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Duplicate case numbers</h2>
          <div className="mt-4 space-y-2">
            {duplicateCaseNumbers.map((entry) => <StatusBadge key={entry.caseNumber} value={`${entry.caseNumber}: ${entry._count._all}`} />)}
            {!duplicateCaseNumbers.length ? <p className="text-sm text-slate-400">No duplicate case numbers detected across courts.</p> : null}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Stale checks</h2>
          <div className="mt-4 space-y-2">
            {staleCases.slice(0, 8).map((courtCase) => (
              <p key={courtCase.id} className="text-sm text-slate-400">{courtCase.caption} · {formatDate(courtCase.lastCheckedAt)}</p>
            ))}
            {!staleCases.length ? <p className="text-sm text-slate-400">No stale cases.</p> : null}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Pending documents</h2>
          <div className="mt-4 space-y-2">
            {pendingDocuments.slice(0, 8).map((document) => (
              <p key={document.id} className="text-sm text-slate-400">{document.title} · {document.case.caseNumber}</p>
            ))}
            {!pendingDocuments.length ? <p className="text-sm text-slate-400">No pending documents.</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-slate-50">Recent import runs</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {recentRuns.map((run) => (
            <div key={run.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-slate-100">{run.source.name}</p>
              <p className="mt-1 text-xs text-slate-500">{run.status} · found {run.recordsFound} · flagged {run.recordsFlaggedForReview}</p>
            </div>
          ))}
          {!recentRuns.length ? <p className="text-sm text-slate-400">No court import runs yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
