import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { CivicDocumentRelatedEntityType, DocumentReviewIssueStatus, DocumentReviewIssueType, ProfileEnrichmentReviewStatus } from "@prisma/client";

import { PageIntro } from "@/components/ui/page-intro";
import { getHighPriorityCandidateEnrichmentQueue } from "@/lib/candidates/enrichment-priority";
import { getCampaignFinanceSourceCard } from "@/lib/civic-data/profile-source-cards";
import { updateCandidateKnowledgeReviewStatusAction, updateEnrichmentReviewStatusAction } from "@/lib/enrichment/actions";
import { getIncumbentOfficialBioQaRows } from "@/lib/incumbents/official-bio-enrichment";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value) : "Not checked yet";
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
      {value.replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">{children}</div>;
}

async function getLombardoDiagnostics() {
  const candidate = await prisma.candidate.findFirst({
    where: {
      OR: [{ fullName: { contains: "Lombardo", mode: "insensitive" } }, { ballotName: { contains: "Lombardo", mode: "insensitive" } }],
      office: { title: { contains: "Governor", mode: "insensitive" } },
    },
    include: {
      office: { select: { title: true } },
      jurisdiction: { select: { name: true } },
      knowledgeEnrichments: true,
      newsMentions: true,
      campaignFinanceFilings: true,
    },
  });
  const official = await prisma.official.findFirst({
    where: {
      OR: [{ fullName: { contains: "Joe Lombardo", mode: "insensitive" } }, { fullName: { contains: "Joseph Lombardo", mode: "insensitive" } }],
      office: { title: { contains: "Governor", mode: "insensitive" } },
    },
    include: {
      office: { select: { title: true } },
      jurisdiction: { select: { name: true } },
      newsMentions: true,
    },
  });
  const targetIds = [candidate?.id, official?.id].filter((id): id is string => Boolean(id));
  const [sourceRows, imageSources, financeSources, financeCardData] = await Promise.all([
    targetIds.length
      ? prisma.profileWebsiteEnrichment.findMany({
          where: { targetId: { in: targetIds } },
          orderBy: [{ reviewStatus: "asc" }, { fetchedAt: "desc" }],
        })
      : [],
    candidate
      ? prisma.sourceAttribution.findMany({
          where: { entityType: "CANDIDATE", entityId: candidate.id, fieldName: "profile_image" },
          orderBy: [{ reviewStatus: "desc" }, { lastImportedAt: "desc" }],
        })
      : [],
    candidate
      ? prisma.sourceAttribution.findMany({
          where: { entityType: "CANDIDATE", entityId: candidate.id, fieldName: "campaign_finance" },
          orderBy: [{ reviewStatus: "desc" }, { lastImportedAt: "desc" }],
        })
      : [],
    candidate ? getCampaignFinanceSourceCard("candidate", candidate.id) : null,
  ]);
  const approvedSources = sourceRows.filter((row) => row.reviewStatus === ProfileEnrichmentReviewStatus.APPROVED || row.reviewStatus === ProfileEnrichmentReviewStatus.VERIFIED);
  const pendingSources = sourceRows.filter((row) => row.reviewStatus === ProfileEnrichmentReviewStatus.PENDING_REVIEW);
  const approvedImageSource = imageSources.find((row) => row.reviewStatus === "approved" || row.reviewStatus === "verified") ?? null;
  const hasBio =
    approvedSources.some((row) => Boolean(row.shortBio)) ||
    candidate?.knowledgeEnrichments.some((row) => Boolean(row.aboutSummary) && (row.reviewStatus === ProfileEnrichmentReviewStatus.APPROVED || row.reviewStatus === ProfileEnrichmentReviewStatus.VERIFIED));
  const missingFields = [
    hasBio ? null : "approved bio",
    candidate?.websiteUrl ? null : "campaign website",
    candidate?.newsMentions.length ? null : "candidate news mentions",
    candidate?.campaignFinanceFilings.length || financeSources.length ? null : "campaign finance links",
    candidate?.photoUrl || approvedImageSource ? null : "approved profile image",
  ].filter((field): field is string => Boolean(field));
  return {
    candidate,
    official,
    aliases: ["Joe Lombardo", "Joseph Lombardo", "Joseph Michael Lombardo", "Governor Joe Lombardo", "Lombardo, Joe", "Lombardo, Joseph"],
    sourceRows,
    approvedSources,
    pendingSources,
    imageSources,
    approvedImageSource,
    financeSources,
    financeCardData,
    newsMentions: (candidate?.newsMentions.length ?? 0) + (official?.newsMentions.length ?? 0),
    campaignFinanceLinks: candidate?.campaignFinanceFilings.length ?? 0,
    missingFields,
    bioDisplayReason: hasBio ? "Approved official government or candidate knowledge bio is available for public display." : "No approved/verified bio source is linked yet.",
  };
}

export default async function AdminCandidateKnowledgeFactoryPage() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const [missingBios, discoveredWebsites, extractedBios, unmatchedDocuments, lowConfidenceKnowledge, priorityQueue, incumbentOfficialBioQueue, lombardoDiagnostics] = await Promise.all([
    prisma.candidate.findMany({
      where: {
        knowledgeEnrichments: {
          none: {
            aboutSummary: { not: null },
            reviewStatus: { in: [ProfileEnrichmentReviewStatus.APPROVED, ProfileEnrichmentReviewStatus.VERIFIED] },
          },
        },
      },
      include: { election: { select: { title: true } }, office: { select: { title: true } } },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.profileWebsiteEnrichment.findMany({
      where: {
        targetType: "CANDIDATE",
        reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
        enrichmentStatus: "DISCOVERED",
      },
      orderBy: [{ confidenceScore: "desc" }, { fetchedAt: "desc" }],
      take: 50,
    }),
    prisma.candidateKnowledgeEnrichment.findMany({
      where: {
        reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
        aboutSummary: { not: null },
      },
      include: { candidate: { select: { fullName: true, ballotName: true } } },
      orderBy: [{ confidenceScore: "desc" }, { fetchedAt: "desc" }],
      take: 50,
    }),
    prisma.civicDocument.findMany({
      where: {
        relatedEntityType: CivicDocumentRelatedEntityType.CANDIDATE,
        relatedEntityId: null,
      },
      include: {
        reviewIssues: {
          where: { status: { in: [DocumentReviewIssueStatus.OPEN, DocumentReviewIssueStatus.IN_REVIEW] } },
          take: 3,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.candidateKnowledgeEnrichment.findMany({
      where: {
        reviewStatus: { in: [ProfileEnrichmentReviewStatus.PENDING_REVIEW, ProfileEnrichmentReviewStatus.NEEDS_MORE_SOURCES] },
        confidenceScore: { lt: 0.55 },
      },
      include: { candidate: { select: { fullName: true, ballotName: true } } },
      orderBy: [{ confidenceScore: "asc" }, { fetchedAt: "desc" }],
      take: 50,
    }),
    getHighPriorityCandidateEnrichmentQueue(25),
    getIncumbentOfficialBioQaRows(25),
    getLombardoDiagnostics(),
  ]);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin · Data Factory"
        title="Candidate Knowledge Ladder"
        description="Review source discovery, candidate media imports, extracted summaries, and missing-bio gaps without publishing unreviewed candidate facts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/data-factory/candidate-knowledge/add-source" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Add source
            </Link>
            <Link href="/admin/data-factory" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Data Factory
            </Link>
            <Link href="/admin/enrichment" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Full enrichment queue
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Missing bios", missingBios.length],
          ["Websites pending", discoveredWebsites.length],
          ["Bios pending", extractedBios.length],
          ["Unmatched docs", unmatchedDocuments.length],
          ["Low confidence", lowConfidenceKnowledge.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-50">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-emerald-50">Statewide incumbent diagnostic: Joe Lombardo</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-100/80">{lombardoDiagnostics.bioDisplayReason}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lombardoDiagnostics.candidate ? (
              <Link href={`/candidates/${lombardoDiagnostics.candidate.id}`} className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white">
                Candidate profile
              </Link>
            ) : null}
            {lombardoDiagnostics.official ? (
              <Link href={`/officials/${lombardoDiagnostics.official.id}`} className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white">
                Official profile
              </Link>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Identity</p>
            <p className="mt-3 text-sm font-semibold text-white">Candidate: {lombardoDiagnostics.candidate?.id ?? "missing"}</p>
            <p className="mt-2 text-sm font-semibold text-white">Official: {lombardoDiagnostics.official?.id ?? "missing"}</p>
            <p className="mt-2 text-xs leading-5 text-emerald-100/70">Person identity id: not modeled yet; linked by normalized alias match.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Sources</p>
            <p className="mt-3 text-sm font-semibold text-white">{lombardoDiagnostics.sourceRows.length} linked source records</p>
            <p className="mt-2 text-xs text-emerald-100/70">{lombardoDiagnostics.approvedSources.length} approved · {lombardoDiagnostics.pendingSources.length} pending</p>
            <p className="mt-2 text-xs text-emerald-100/70">{lombardoDiagnostics.newsMentions} news mentions · {lombardoDiagnostics.campaignFinanceLinks} finance links</p>
            <p className="mt-2 text-xs text-emerald-100/70">{lombardoDiagnostics.imageSources.length} image source rows · {lombardoDiagnostics.financeSources.length} finance source rows</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Aliases</p>
            <p className="mt-3 text-xs leading-5 text-emerald-50">{lombardoDiagnostics.aliases.join(" · ")}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Linked source records</p>
            <div className="mt-3 space-y-2">
              {lombardoDiagnostics.sourceRows.map((row) => (
                <a key={row.id} href={row.sourceUrl} target="_blank" rel="noreferrer" className="block break-all text-xs font-semibold text-cyan-100">
                  {row.sourceName ?? "Source"} · {row.reviewStatus.toLowerCase()} · {row.sourceUrl}
                </a>
              ))}
              {!lombardoDiagnostics.sourceRows.length ? <p className="text-sm text-emerald-100/70">No source records linked.</p> : null}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Image + finance diagnostics</p>
            <div className="mt-3 space-y-2 text-xs leading-5 text-emerald-50">
              <p>Candidate photo URL: {lombardoDiagnostics.candidate?.photoUrl ?? "missing"}</p>
              <p>Approved image source: {lombardoDiagnostics.approvedImageSource?.sourceUrl ?? "none"}</p>
              <p>Finance card source: {lombardoDiagnostics.financeCardData?.sourceUrl ?? "none"}</p>
              <p>Finance filings parsed: {lombardoDiagnostics.financeCardData?.filingCount ?? 0}</p>
              <p>Finance card status: {lombardoDiagnostics.financeCardData?.filingStatus ?? lombardoDiagnostics.financeCardData?.donorExtractionStatus ?? "hidden: no source"}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Missing fields</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {lombardoDiagnostics.missingFields.length ? (
                lombardoDiagnostics.missingFields.map((field) => <StatusBadge key={field} value={field} />)
              ) : (
                <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-white">No priority gaps detected</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Incumbent official bio QA</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Candidate-to-official matches, official jurisdiction sources, and pending official government bio enrichment.
            </p>
          </div>
          <code className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">npm run civic:import-incumbent-official-bios</code>
        </div>
        <div className="mt-4 space-y-3">
          {incumbentOfficialBioQueue.length ? (
            incumbentOfficialBioQueue.map((row) => (
              <article key={`${row.candidateId}-${row.officialId ?? "none"}`} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-50">{row.candidateName}</p>
                      <StatusBadge value={row.status} />
                      {row.confidenceScore ? <StatusBadge value={`${Math.round(row.confidenceScore * 100)} confidence`} /> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{row.race}</p>
                    {row.officialName ? <p className="mt-2 text-xs text-slate-500">Matched official: {row.officialName}</p> : null}
                    {row.officialSourceUrl ? (
                      <a href={row.officialSourceUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs font-semibold text-cyan-200">
                        {row.officialSourceUrl}
                      </a>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/candidates/${row.candidateId}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200">
                      Candidate
                    </Link>
                    {row.officialId ? (
                      <Link href={`/officials/${row.officialId}`} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                        Official
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState>No incumbent official bio QA rows are visible yet.</EmptyState>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">High-priority enrichment queue</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Ranked from real imported candidates using race scope, contested status, office type, upcoming elections, and missing profile fields.
            </p>
          </div>
          <Link href="/admin/data-factory/candidate-knowledge/add-source" className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100">
            Add source URL
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {priorityQueue.length ? (
            priorityQueue.map((row) => (
              <article key={row.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-50">{row.name}</p>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                        Priority {row.score}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{row.race}</p>
                    <p className="mt-2 text-xs text-slate-500">Search: {row.suggestedSearchQuery}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.missingFields.map((field) => (
                        <StatusBadge key={field} value={field} />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/data-factory/candidate-knowledge/add-source?candidateId=${row.id}`} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                      Add source
                    </Link>
                    <Link href={`/candidates/${row.id}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200">
                      Open profile
                    </Link>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState>No candidate enrichment priorities are available yet.</EmptyState>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-slate-50">Missing bios</h2>
        <div className="mt-4 space-y-3">
          {missingBios.length ? (
            missingBios.map((candidate) => (
              <div key={candidate.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-50">{candidate.ballotName ?? candidate.fullName}</p>
                    <p className="mt-1 text-sm text-slate-400">{candidate.office?.title ?? candidate.election.title}</p>
                    <p className="mt-2 text-xs text-slate-500">Bio source not found yet. Candidate filing facts remain visible publicly.</p>
                  </div>
                  <Link href={`/candidates/${candidate.id}`} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                    Open profile
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <EmptyState>No missing candidate bios found in the current page of records.</EmptyState>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-slate-50">Discovered websites pending review</h2>
        <div className="mt-4 space-y-3">
          {discoveredWebsites.length ? (
            discoveredWebsites.map((row) => (
              <article key={row.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-50">{row.targetName}</p>
                    <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs font-semibold text-cyan-200">
                      {row.sourceUrl}
                    </a>
                    <p className="mt-2 text-xs text-slate-500">Discovered {formatDate(row.fetchedAt)} · confidence {(row.confidenceScore * 100).toFixed(0)}%</p>
                  </div>
                  <form action={updateEnrichmentReviewStatusAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="enrichmentId" value={row.id} />
                    <input type="hidden" name="reviewNotes" value="Reviewed from Candidate Knowledge Ladder." />
                    <button name="reviewStatus" value="APPROVED" className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100">
                      Approve
                    </button>
                    <button name="reviewStatus" value="REJECTED" className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-100">
                      Reject
                    </button>
                    <button type="button" disabled className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-500">
                      Edit
                    </button>
                  </form>
                </div>
              </article>
            ))
          ) : (
            <EmptyState>No discovered website suggestions are pending review.</EmptyState>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-slate-50">Extracted bios pending review</h2>
        <div className="mt-4 space-y-3">
          {extractedBios.length ? (
            extractedBios.map((row) => (
              <article key={row.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-50">{row.candidate.ballotName ?? row.candidate.fullName}</p>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{row.aboutSummary}</p>
                    <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs font-semibold text-cyan-200">
                      Source: {row.sourceName}
                    </a>
                    <p className="mt-2 text-xs text-slate-500">Fetched {formatDate(row.fetchedAt)} · confidence {(row.confidenceScore * 100).toFixed(0)}%</p>
                  </div>
                  <form action={updateCandidateKnowledgeReviewStatusAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="knowledgeEnrichmentId" value={row.id} />
                    <input type="hidden" name="candidateId" value={row.candidateId} />
                    <input type="hidden" name="reviewNotes" value="Reviewed from Candidate Knowledge Ladder." />
                    <button name="reviewStatus" value="APPROVED" className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100">
                      Approve
                    </button>
                    <button name="reviewStatus" value="REJECTED" className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-100">
                      Reject
                    </button>
                    <button type="button" disabled className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-500">
                      Edit
                    </button>
                  </form>
                </div>
              </article>
            ))
          ) : (
            <EmptyState>No extracted bios are pending review.</EmptyState>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Unmatched candidate media documents</h2>
          <div className="mt-4 space-y-3">
            {unmatchedDocuments.length ? (
              unmatchedDocuments.map((document) => (
                <div key={document.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <p className="font-semibold text-slate-50">{document.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{document.originalFilename ?? document.localFilePath ?? "Local document"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {document.reviewIssues.map((issue) => (
                      <StatusBadge key={issue.id} value={issue.issueType} />
                    ))}
                    {!document.reviewIssues.length ? <StatusBadge value={DocumentReviewIssueType.UNMATCHED_ENTITY} /> : null}
                  </div>
                  <Link href="/admin/documents/review" className="mt-3 inline-flex text-xs font-semibold text-cyan-200">
                    Open document review
                  </Link>
                </div>
              ))
            ) : (
              <EmptyState>No unmatched candidate media documents are waiting in this queue.</EmptyState>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Low confidence matches</h2>
          <div className="mt-4 space-y-3">
            {lowConfidenceKnowledge.length ? (
              lowConfidenceKnowledge.map((row) => (
                <div key={row.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <p className="font-semibold text-slate-50">{row.candidate.ballotName ?? row.candidate.fullName}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.sourceName} · {(row.confidenceScore * 100).toFixed(0)}% confidence</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{row.errorLog ?? "Review source match before publishing."}</p>
                  <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs font-semibold text-cyan-200">
                    Open source
                  </a>
                </div>
              ))
            ) : (
              <EmptyState>No low-confidence candidate knowledge rows are visible right now.</EmptyState>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
