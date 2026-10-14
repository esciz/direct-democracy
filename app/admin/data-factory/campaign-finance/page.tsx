import Link from "next/link";
import { redirect } from "next/navigation";
import { CivicEntityType, CivicRecordReviewStatus } from "@prisma/client";

import { PageIntro } from "@/components/ui/page-intro";
import { updateCampaignFinanceSourceReviewAction } from "@/lib/campaign-finance/actions";
import { getCampaignFinanceSourceCard } from "@/lib/civic-data/profile-source-cards";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

function formatDate(value: Date | string | null) {
  if (!value) return "Not checked";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

async function getLombardoFinanceDiagnostics() {
  const candidate = await prisma.candidate.findFirst({
    where: {
      OR: [
        { fullName: { contains: "Lombardo", mode: "insensitive" } },
        { ballotName: { contains: "Lombardo", mode: "insensitive" } },
      ],
      office: { title: { contains: "Governor", mode: "insensitive" } },
    },
    include: { office: { select: { title: true } }, campaignFinanceFilings: true },
  });
  const official = await prisma.official.findFirst({
    where: {
      OR: [
        { fullName: { contains: "Joe Lombardo", mode: "insensitive" } },
        { fullName: { contains: "Joseph Lombardo", mode: "insensitive" } },
        { fullName: { contains: "Lombardo", mode: "insensitive" } },
      ],
      office: { title: { contains: "Governor", mode: "insensitive" } },
    },
    include: { office: { select: { title: true } } },
  });
  const candidateCard = candidate ? await getCampaignFinanceSourceCard("candidate", candidate.id) : null;
  const officialCard = official ? await getCampaignFinanceSourceCard("official", official.id) : null;
  const [sourceRecords, sourceAttributions, documents] = await Promise.all([
    candidate
      ? prisma.sourceRecord.findMany({
          where: { entityType: CivicEntityType.CANDIDATE, entityId: candidate.id },
          orderBy: { importedAt: "desc" },
          take: 10,
        })
      : [],
    candidate
      ? prisma.sourceAttribution.findMany({
          where: { entityType: CivicEntityType.CANDIDATE, entityId: candidate.id, fieldName: "campaign_finance" },
          orderBy: { lastImportedAt: "desc" },
          take: 10,
        })
      : [],
    candidate
      ? prisma.civicDocument.findMany({
          where: { documentType: "CAMPAIGN_FINANCE_FILING", relatedEntityId: candidate.id },
          include: { extractionRuns: { orderBy: { startedAt: "desc" }, take: 1 } },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : [],
  ]);

  return {
    candidate,
    official,
    aliases: ["Joe Lombardo", "Joseph Lombardo", "Joseph Michael Lombardo", "Lombardo, Joe", "Lombardo, Joseph"],
    sourceRecords,
    sourceAttributions,
    documents,
    candidateCard,
    officialCard,
  };
}

export default async function AdminCampaignFinanceFactoryPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") redirect("/profile");

  const [diagnostics, attributions, filings, documents] = await Promise.all([
    getLombardoFinanceDiagnostics(),
    prisma.sourceAttribution.findMany({
      where: { fieldName: "campaign_finance" },
      orderBy: [{ reviewStatus: "asc" }, { lastImportedAt: "desc" }],
      take: 50,
    }),
    prisma.campaignFinanceFiling.findMany({
      orderBy: [{ filedAt: "desc" }, { updatedAt: "desc" }],
      include: { candidate: { select: { fullName: true, ballotName: true } }, source: { select: { name: true } } },
      take: 50,
    }),
    prisma.civicDocument.findMany({
      where: { documentType: "CAMPAIGN_FINANCE_FILING" },
      include: { extractionRuns: { orderBy: { startedAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin · Data Factory"
        title="Campaign finance"
        description="Source-linked finance filings, manual fallbacks, PDF intake, and review controls. Public cards show sources and filing names before donor extraction is complete."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/data-factory/campaign-finance/add-source" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Add source
            </Link>
            <Link href="/admin/data-factory/campaign-finance/upload" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Upload PDF
            </Link>
            <Link href="/admin/documents/review" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Document review
            </Link>
          </div>
        }
      />

      <section className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-emerald-50">Joe Lombardo diagnostics</h2>
            <p className="mt-2 text-sm text-emerald-100/80">Person identity is not modeled yet; candidate and official matching use normalized aliases.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {diagnostics.candidate ? <Link href={`/candidates/${diagnostics.candidate.id}`} className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white">Candidate profile</Link> : null}
            {diagnostics.official ? <Link href={`/officials/${diagnostics.official.id}`} className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white">Official profile</Link> : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-emerald-50">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Identity</p>
            <p className="mt-3">candidate id: {diagnostics.candidate?.id ?? "missing"}</p>
            <p>official id: {diagnostics.official?.id ?? "missing"}</p>
            <p>person id: not modeled</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-emerald-50">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Counts</p>
            <p className="mt-3">finance source count: {diagnostics.candidateCard?.financeSourceCount ?? 0}</p>
            <p>finance filing count: {diagnostics.candidateCard?.financeFilingCount ?? 0}</p>
            <p>finance document count: {diagnostics.candidateCard?.financeDocumentCount ?? 0}</p>
            <p>pending/approved: {diagnostics.candidateCard?.pendingCount ?? 0}/{diagnostics.candidateCard?.approvedCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-emerald-50">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Card data</p>
            <p className="mt-3 break-all">source: {diagnostics.candidateCard?.sourceUrl ?? "none"}</p>
            <p>filings passed: {diagnostics.candidateCard?.filingSummaries.length ?? 0}</p>
            <p>status: {diagnostics.candidateCard?.filingStatus ?? diagnostics.candidateCard?.donorExtractionStatus ?? "none"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-emerald-50">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Aliases</p>
            <p className="mt-3 text-xs leading-5">{diagnostics.aliases.join(" · ")}</p>
          </div>
        </div>
        <pre className="mt-4 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-emerald-50">
          {JSON.stringify(diagnostics.candidateCard, null, 2)}
        </pre>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Source links</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{attributions.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Filing rows</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{filings.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">PDF/documents</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{documents.length}</p>
        </div>
      </section>

      <section className="space-y-3">
        {attributions.map((row) => (
          <article key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-white">{row.sourceName}</p>
                <a href={row.sourceUrl ?? "#"} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs font-semibold text-cyan-200">
                  {row.sourceUrl ?? "No URL"}
                </a>
                <p className="mt-2 text-xs text-slate-500">{row.entityType} · {row.entityId} · {row.reviewStatus}</p>
              </div>
              <form action={updateCampaignFinanceSourceReviewAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="attributionId" value={row.id} />
                <select name="reviewStatus" defaultValue={row.reviewStatus} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100">
                  {Object.values(CivicRecordReviewStatus).map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <button className="dd-button-secondary rounded-xl px-4 py-2 text-sm font-semibold" type="submit">Save</button>
              </form>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        {filings.map((filing) => (
          <article key={filing.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="font-semibold text-white">{filing.candidate?.ballotName ?? filing.candidate?.fullName ?? filing.filerName}</p>
            <p className="mt-1 text-sm text-slate-400">{filing.source?.name ?? "Campaign finance source"} · {formatDate(filing.filedAt)}</p>
            {filing.filingUrl ? <a href={filing.filingUrl} className="mt-2 block break-all text-xs font-semibold text-cyan-200">{filing.filingUrl}</a> : null}
          </article>
        ))}
      </section>
    </div>
  );
}

