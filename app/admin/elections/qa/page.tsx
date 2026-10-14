import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type QaItem = {
  id: string;
  label: string;
  group: string;
  sourceName: string | null;
  flags: string[];
};

function duplicateFlags(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function hasSuspiciousElectionDate(title: string, date: Date) {
  const normalizedTitle = title.toLowerCase();
  const isoDay = date.toISOString().slice(0, 10);

  if (normalizedTitle.includes("2026") && normalizedTitle.includes("primary") && isoDay !== "2026-06-09") return true;
  if (normalizedTitle.includes("2026") && normalizedTitle.includes("general") && isoDay !== "2026-11-03") return true;

  return date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 2035;
}

function officeUsuallyNeedsDistrict(officeTitle: string | null) {
  if (!officeTitle) return false;
  const normalized = officeTitle.toLowerCase();
  return normalized.includes("district") || normalized.includes("ward") || normalized.includes("department") || normalized.includes("seat");
}

export default async function AdminElectionsQaPage() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const [elections, candidates, questions, recentRuns] = await Promise.all([
    prisma.election.findMany({
      include: {
        jurisdiction: { select: { name: true } },
        office: { select: { title: true } },
        source: { select: { name: true } },
        _count: { select: { candidates: true, ballotInitiatives: true } },
      },
      orderBy: [{ electionDate: "desc" }, { title: "asc" }],
      take: 150,
    }),
    prisma.candidate.findMany({
      include: {
        election: { select: { title: true } },
        office: { select: { title: true } },
        district: { select: { name: true } },
        source: { select: { name: true } },
      },
      orderBy: [{ fullName: "asc" }],
      take: 300,
    }),
    prisma.ballotQuestion.findMany({
      include: {
        election: { select: { title: true } },
        source: { select: { name: true } },
      },
      orderBy: [{ questionNumber: "asc" }],
      take: 200,
    }),
    prisma.sourceSyncRun.findMany({
      where: {
        source: {
          slug: "nevada-secretary-of-state-elections",
        },
      },
      include: {
        source: { select: { name: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
  ]);

  const candidateNameCounts = duplicateFlags(candidates.map((candidate) => candidate.fullName.toLowerCase()));
  const electionTitleCounts = duplicateFlags(elections.map((election) => `${election.title}|${election.electionDate.toISOString()}`.toLowerCase()));
  const questionCounts = duplicateFlags(questions.map((question) => `${question.questionNumber ?? ""}|${question.title}`.toLowerCase()));

  const electionItems: QaItem[] = elections.map((election) => ({
    id: election.id,
    label: election.title,
    group: "Election",
    sourceName: election.source?.name ?? null,
    flags: [
      !election.source ? "Missing source" : null,
      !election.officeTitle ? "Missing office title" : null,
      electionTitleCounts.get(`${election.title}|${election.electionDate.toISOString()}`.toLowerCase())! > 1 ? "Duplicate election" : null,
      hasSuspiciousElectionDate(election.title, election.electionDate) ? "Suspicious election date" : null,
      election._count.candidates === 0 && election._count.ballotInitiatives === 0 ? "No linked candidates or measures" : null,
    ].filter((flag): flag is string => Boolean(flag)),
  }));

  const candidateItems: QaItem[] = candidates.map((candidate) => ({
    id: candidate.id,
    label: candidate.fullName,
    group: "Candidate",
    sourceName: candidate.source?.name ?? null,
    flags: [
      !candidate.source ? "Missing source" : null,
      !candidate.election ? "Missing election link" : null,
      !candidate.office ? "Missing office" : null,
      !candidate.jurisdictionId ? "Missing jurisdiction" : null,
      officeUsuallyNeedsDistrict(candidate.office?.title ?? null) && !candidate.district ? "Missing district" : null,
      !candidate.partyText ? "Missing party" : null,
      !candidate.sourceUrl ? "Missing source URL" : null,
      candidate.status === "NEEDS_REVIEW" ? "Candidate needing review" : null,
      candidateNameCounts.get(candidate.fullName.toLowerCase())! > 1 ? "Duplicate candidate name" : null,
    ].filter((flag): flag is string => Boolean(flag)),
  }));

  const questionItems: QaItem[] = questions.map((question) => ({
    id: question.id,
    label: question.questionNumber ? `${question.questionNumber}: ${question.title}` : question.title,
    group: "Ballot measure",
    sourceName: question.source?.name ?? null,
    flags: [
      !question.source ? "Missing source" : null,
      !question.election ? "Missing election link" : null,
      !question.jurisdictionId ? "Missing jurisdiction" : null,
      !question.summary ? "Missing summary" : null,
      !question.fullTextUrl ? "Missing full text URL" : null,
      question.passed === null ? "Missing outcome" : null,
      questionCounts.get(`${question.questionNumber ?? ""}|${question.title}`.toLowerCase())! > 1 ? "Duplicate measure" : null,
    ].filter((flag): flag is string => Boolean(flag)),
  }));

  const items = [...electionItems, ...candidateItems, ...questionItems];
  const cleanCount = items.filter((item) => item.flags.length === 0).length;
  const warningCount = items.length - cleanCount;
  const manualReviewCount = items.filter((item) => item.flags.length > 0).length;
  const importWarnings = recentRuns.flatMap((run) => (run.errorLog ? run.errorLog.split("\n").filter(Boolean) : []));

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin QA"
        title="Election import QA"
        description="Inspect imported elections, candidates, and ballot measures for missing relationships, duplicate records, source warnings, and date problems."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/elections" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Elections
            </Link>
            <Link href="/admin/ballot-measures" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Measures
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["Records checked", items.length],
          ["Clean records", cleanCount],
          ["Records with warnings", warningCount],
          ["Needs manual review", manualReviewCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-50">{Number(value).toLocaleString()}</p>
          </div>
        ))}
      </section>

      {importWarnings.length > 0 ? (
        <section className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-5">
          <h2 className="font-semibold text-amber-100">Source warnings</h2>
          <div className="mt-3 space-y-2">
            {importWarnings.map((warning, index) => (
              <p key={`${warning}-${index}`} className="text-sm leading-6 text-amber-50">
                {warning}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="grid gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 md:grid-cols-[0.55fr_1.2fr_0.9fr_1.2fr]">
          <span>Type</span>
          <span>Record</span>
          <span>Source</span>
          <span>QA flags</span>
        </div>
        <div className="divide-y divide-white/10">
          {items.map((item) => (
            <article key={`${item.group}-${item.id}`} className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[0.55fr_1.2fr_0.9fr_1.2fr]">
              <p className="font-semibold text-slate-100">{item.group}</p>
              <p className="text-slate-200">{item.label}</p>
              <p className="text-slate-400">{item.sourceName ?? "No source"}</p>
              <div className="flex flex-wrap gap-2">
                {item.flags.length > 0 ? (
                  item.flags.map((flag) => (
                    <span key={flag} className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-100">
                      {flag}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">Clean</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
