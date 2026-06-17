import Link from "next/link";
import { redirect } from "next/navigation";

import { CandidateKnowledgeSourceType } from "@prisma/client";

import { PageIntro } from "@/components/ui/page-intro";
import {
  addCandidateKnowledgeSourceAction,
  linkCandidateKnowledgeToIssuePositionAction,
  linkCandidateKnowledgeToNewsMentionAction,
  runCandidateKnowledgeEnrichmentAction,
  runProfileWebsiteEnrichmentAction,
  updateCandidateKnowledgeReviewStatusAction,
  updateEnrichmentReviewStatusAction,
  uploadCandidateKnowledgeDocumentAction,
} from "@/lib/enrichment/actions";
import { getAdminCandidateKnowledgeQueue, type AdminCandidateKnowledgeRow } from "@/lib/enrichment/candidate-knowledge";
import { getAdminEnrichmentQueue, getAdminEnrichmentTargets, type AdminEnrichmentRow } from "@/lib/enrichment/website";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type AdminEnrichmentPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

const reviewStatuses = ["PENDING_REVIEW", "APPROVED", "VERIFIED", "REJECTED", "NEEDS_MORE_SOURCES"] as const;
const issueStances = ["UNKNOWN", "SUPPORTS", "OPPOSES", "MIXED", "CHANGED"] as const;

function sourceTypeLabel(value: string) {
  const labels: Record<string, string> = {
    SOS_PUBLIC_MEDIA: "Nevada SOS candidate media document",
    CAMPAIGN_WEBSITE: "Campaign website",
    OFFICIAL_WEBSITE: "Official website",
    BALLOTPEDIA: "Ballotpedia",
    VOTE_SMART: "Vote Smart reference",
    NEWS_ARTICLE: "News article",
    PRESS_RELEASE: "Press release",
    SOCIAL_PROFILE: "Social profile",
    OFFICIAL_SOCIAL: "Official social profile",
    LEGISLATIVE_VOTE: "Legislative vote",
    CAMPAIGN_FINANCE: "Campaign finance filing",
    FILING_RECORD: "Official filing record",
    OTHER: "Other source",
  };
  return labels[value] ?? value.replace(/_/g, " ");
}

function formatFieldLabel(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function formatFieldValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function ReviewCard({ row }: { row: AdminEnrichmentRow }) {
  const proposedEntries = Object.entries(row.proposedFields);
  const sourceEntries = Object.entries(row.fieldSources);

  return (
    <article className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-50">{row.targetName}</p>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-cyan-100">
              {row.targetType}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-300">
              {row.reviewStatus.replace(/_/g, " ")}
            </span>
          </div>
          <a href={row.sourceUrl} className="mt-2 block break-all text-xs text-cyan-200 hover:text-cyan-100" rel="noreferrer" target="_blank">
            {row.sourceUrl}
          </a>
          <p className="mt-1 text-xs text-slate-500">
            Fetched {row.fetchedAt.toLocaleString()} · Confidence {(row.confidenceScore * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {row.errorLog ? (
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">{row.errorLog}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Proposed fields</h2>
          {proposedEntries.length > 0 ? (
            <div className="space-y-2">
              {proposedEntries.map(([key, value]) => (
                <div key={key} className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{formatFieldLabel(key)}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-200">{formatFieldValue(value)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 bg-slate-950/35 p-3 text-sm text-slate-400">No usable profile fields were extracted.</p>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Field sources</h2>
          {sourceEntries.length > 0 ? (
            <div className="space-y-2">
              {sourceEntries.map(([key, urls]) => (
                <div key={key} className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{formatFieldLabel(key)}</p>
                  {(Array.isArray(urls) ? urls : []).map((url) => (
                    <a key={url} href={url} className="mt-1 block break-all text-xs text-cyan-200 hover:text-cyan-100" rel="noreferrer" target="_blank">
                      {url}
                    </a>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 bg-slate-950/35 p-3 text-sm text-slate-400">No field-level sources recorded.</p>
          )}
        </div>
      </div>

      <form action={updateEnrichmentReviewStatusAction} className="grid gap-3 border-t border-white/10 pt-4 md:grid-cols-[0.7fr_1fr_auto]">
        <input name="enrichmentId" type="hidden" value={row.id} />
        <select
          className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          defaultValue={row.reviewStatus}
          name="reviewStatus"
        >
          {reviewStatuses.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <input
          className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          defaultValue={row.reviewNotes ?? ""}
          name="reviewNotes"
          placeholder="Review notes"
        />
        <button className="dd-button-primary rounded-xl px-4 py-2 text-sm font-semibold" type="submit">
          Save review
        </button>
      </form>
    </article>
  );
}

function CandidateKnowledgeReviewCard({ row }: { row: AdminCandidateKnowledgeRow }) {
  const issueLabels = row.issues.map((issue) => issue.label).join(", ");

  return (
    <article className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-50">{row.candidateName}</p>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-emerald-100">
              {sourceTypeLabel(row.sourceType)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-300">
              {row.reviewStatus.replace(/_/g, " ")}
            </span>
          </div>
          <a href={row.sourceUrl} className="mt-2 block break-all text-xs text-cyan-200 hover:text-cyan-100" rel="noreferrer" target="_blank">
            {row.sourceUrl}
          </a>
          <p className="mt-1 text-xs text-slate-500">
            Fetched {row.fetchedAt.toLocaleString()} - Confidence {(row.confidenceScore * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {row.errorLog ? <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">{row.errorLog}</div> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">About / bio</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{row.aboutSummary ?? "Bio source not found yet."}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Candidate's own words</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{row.ownWordsSummary ?? "Candidate-provided summary not found yet."}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Issues / priorities</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{issueLabels || "Issue source not found yet."}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Experience / background</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{row.experienceSummary ?? "Experience source not found yet."}</p>
        </div>
      </div>

      <form action={updateCandidateKnowledgeReviewStatusAction} className="grid gap-3 border-t border-white/10 pt-4 md:grid-cols-[0.7fr_1fr_auto]">
        <input name="knowledgeEnrichmentId" type="hidden" value={row.id} />
        <input name="candidateId" type="hidden" value={row.candidateId} />
        <select className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" defaultValue={row.reviewStatus} name="reviewStatus">
          {reviewStatuses.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <input
          className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          defaultValue={row.reviewNotes ?? ""}
          name="reviewNotes"
          placeholder="Review notes"
        />
        <button className="dd-button-primary rounded-xl px-4 py-2 text-sm font-semibold" type="submit">
          Save review
        </button>
      </form>

      <div className="grid gap-3 border-t border-white/10 pt-4 lg:grid-cols-2">
        <form action={linkCandidateKnowledgeToIssuePositionAction} className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/35 p-3">
          <input name="knowledgeEnrichmentId" type="hidden" value={row.id} />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Link to issue position</p>
          <input name="issueText" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Issue, e.g. Housing affordability" />
          <select name="stance" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            {issueStances.map((stance) => (
              <option key={stance} value={stance}>
                {stance.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <input name="summary" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Optional position summary" />
          <button className="dd-button-secondary rounded-xl px-4 py-2 text-sm font-semibold" type="submit">
            Create pending issue link
          </button>
        </form>

        <form action={linkCandidateKnowledgeToNewsMentionAction} className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/35 p-3">
          <input name="knowledgeEnrichmentId" type="hidden" value={row.id} />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Link to news mentions</p>
          <p className="text-sm leading-6 text-slate-400">
            Creates a pending candidate news mention from this source summary. Review it in the news queue before public display.
          </p>
          <button className="dd-button-secondary rounded-xl px-4 py-2 text-sm font-semibold" type="submit">
            Create pending news link
          </button>
        </form>
      </div>
    </article>
  );
}

export default async function AdminEnrichmentPage({ searchParams }: AdminEnrichmentPageProps) {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const params = searchParams ? await searchParams : undefined;
  const status = params?.status ?? "PENDING_REVIEW";
  const [targets, queue, candidateKnowledgeQueue] = await Promise.all([
    getAdminEnrichmentTargets(),
    getAdminEnrichmentQueue(status),
    getAdminCandidateKnowledgeQueue(status),
  ]);
  const candidateTargets = targets.filter((target) => target.targetType === "CANDIDATE");

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Profile enrichment review"
        description="Fetch conservative website-derived profile suggestions for existing candidates and officials, then review them before any future publishing workflow."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/data" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Data Admin
            </Link>
            <Link href="/admin/enrichment?status=all" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              All Reviews
            </Link>
          </div>
        }
      />

      <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-5">
        <h2 className="text-lg font-semibold text-slate-50">Safety rules</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
          Enrichment stores source-backed summaries and source URLs only. It does not overwrite verified candidate or official data, does not publish
          unreviewed scraped content, summarizes instead of copying full text, and uses conservative rate limits.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-50">Run enrichment</h2>
            <p className="mt-1 text-sm text-slate-400">Existing candidates and officials with website or source URLs are eligible.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="grid gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 md:grid-cols-[0.6fr_1fr_1fr_1fr_0.8fr_1.4fr_auto]">
            <span>Type</span>
            <span>Name</span>
            <span>Office/Race</span>
            <span>Jurisdiction</span>
            <span>Status</span>
            <span>Source URL</span>
            <span>Action</span>
          </div>
          <div className="divide-y divide-white/10">
            {targets.length > 0 ? (
              targets.map((target) => {
                const url = target.websiteUrl ?? target.sourceUrl ?? "";

                return (
                  <form
                    key={`${target.targetType}:${target.id}`}
                    action={runProfileWebsiteEnrichmentAction}
                    className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[0.6fr_1fr_1fr_1fr_0.8fr_1.4fr_auto]"
                  >
                    <input name="targetType" type="hidden" value={target.targetType} />
                    <input name="targetId" type="hidden" value={target.id} />
                    <input name="candidateId" type="hidden" value={target.id} />
                    <p className="font-semibold text-cyan-100">{target.targetType}</p>
                    <p className="font-semibold text-slate-50">{target.name}</p>
                    <p className="text-slate-300">{target.officeOrRace}</p>
                    <p className="text-slate-300">{target.jurisdictionName}</p>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{target.latestStatus?.replace(/_/g, " ") ?? "Not fetched"}</p>
                    <input
                      className="min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500"
                      defaultValue={url}
                      name="sourceUrl"
                      placeholder="Allowed official/campaign URL"
                    />
                    <button className="dd-button-secondary rounded-xl px-4 py-2 text-sm font-semibold" disabled={!url} type="submit">
                      Fetch
                    </button>
                    {target.targetType === "CANDIDATE" ? (
                      <button formAction={runCandidateKnowledgeEnrichmentAction} className="dd-button-secondary rounded-xl px-4 py-2 text-sm font-semibold" type="submit">
                        Knowledge
                      </button>
                    ) : null}
                  </form>
                );
              })
            ) : (
              <p className="px-4 py-8 text-sm text-slate-400">No enrichment targets are available yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Candidate source repository</h2>
          <p className="mt-1 text-sm text-slate-400">
            Attach URLs or upload local source documents. Sources are summarized, attributed, and kept pending until approved or verified.
          </p>
        </div>
        <form action={addCandidateKnowledgeSourceAction} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_1.3fr_0.8fr_1fr_auto]">
          <select name="candidateId" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            {candidateTargets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name} - {target.officeOrRace}
              </option>
            ))}
          </select>
          <input name="sourceUrl" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="https://..." />
          <select name="sourceType" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            {Object.values(CandidateKnowledgeSourceType).map((sourceType) => (
              <option key={sourceType} value={sourceType}>
                {sourceTypeLabel(sourceType)}
              </option>
            ))}
          </select>
          <input name="sourceName" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Optional source label" />
          <button className="dd-button-primary rounded-xl px-4 py-2 text-sm font-semibold" type="submit">
            Add source
          </button>
        </form>
        <form
          action={uploadCandidateKnowledgeDocumentAction}
          className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_1fr_0.8fr_1fr_auto]"
        >
          <select name="candidateId" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            {candidateTargets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name} - {target.officeOrRace}
              </option>
            ))}
          </select>
          <input
            name="sourceDocument"
            type="file"
            accept=".pdf,.txt,.text,.html,.htm,.md"
            className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-cyan-100"
          />
          <select name="sourceType" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            {Object.values(CandidateKnowledgeSourceType).map((sourceType) => (
              <option key={sourceType} value={sourceType}>
                {sourceTypeLabel(sourceType)}
              </option>
            ))}
          </select>
          <input name="sourceName" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" placeholder="Source label" />
          <button className="dd-button-primary rounded-xl px-4 py-2 text-sm font-semibold" type="submit">
            Upload source
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-50">Review queue</h2>
            <p className="mt-1 text-sm text-slate-400">Approvals are review markers only; proposed fields remain separate from live profile data.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["PENDING_REVIEW", "NEEDS_MORE_SOURCES", "APPROVED", "VERIFIED", "REJECTED", "all"].map((statusValue) => (
              <Link
                key={statusValue}
                href={`/admin/enrichment?status=${statusValue}`}
                className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${
                  status === statusValue
                    ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200"
                }`}
              >
                {statusValue.replace(/_/g, " ")}
              </Link>
            ))}
          </div>
        </div>
        {queue.length > 0 ? (
          <div className="space-y-4">
            {queue.map((row) => (
              <ReviewCard key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">No enrichment rows match this filter.</p>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Candidate knowledge review</h2>
          <p className="mt-1 text-sm text-slate-400">Approved and verified rows become the public About, own-words, issues, background, news, and source modules.</p>
        </div>
        {candidateKnowledgeQueue.length > 0 ? (
          <div className="space-y-4">
            {candidateKnowledgeQueue.map((row) => (
              <CandidateKnowledgeReviewCard key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">No candidate knowledge rows match this filter.</p>
        )}
      </section>
    </div>
  );
}
