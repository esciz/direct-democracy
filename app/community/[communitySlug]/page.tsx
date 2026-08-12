import Link from "next/link";
import { notFound } from "next/navigation";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";

import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { CivicAvatar } from "@/components/domain/civic-avatar";
import { CommunityPageNav } from "@/components/domain/community-page-nav";
import { CivicDetails } from "@/components/ui/civic-details";
import { SectionHeading } from "@/components/ui/section-heading";
import { getResidentQuestionAnswersForTarget } from "@/lib/cases/resident-intake-store";
import { decisionCardSummary, decisionHeadline, highLevelSummary, plainLanguageTitle, projectCardSummary, projectHeadline } from "@/lib/civic/plain-language";
import { getDecisionTrustView } from "@/lib/civic/public-decision-trust";
import { getCommunityHubData, getStoryDestination, type CommunityHubDecision, type CommunityHubEvent, type CommunityHubOfficial, type CommunityHubProject } from "@/lib/community/product-hub";
import type { CommunityRelationshipRecord } from "@/lib/community/relationships";

type CommunityPageProps = {
  params: Promise<{
    communitySlug: string;
  }>;
};

type DataopsMonitoring = {
  generatedAt?: string;
  records?: Array<{
    jurisdiction: string | null;
    healthStatus: string;
    freshnessStatus: string;
    documentCounts: { discovered: number; cached: number; extracted: number; queued: number; ocrRequired: number };
  }>;
  audit?: { totals?: Record<string, number> };
};

function readGenerated<T>(fileName: string, fallback: T): T {
  const filePath = path.join(process.cwd(), "data", "generated", fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Date pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date pending";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "Date pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date pending";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function confidenceLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return "Confidence unknown";
  return `${Math.round(value * 100)}% confidence`;
}

function isReaderReady(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (!text || text.length > 420) return false;
  return ![
    /^[/$\d]/,
    /\bsection\s+\d+[a-z]?\b/i,
    /\bherewith\s+submits\b/i,
    /\bnot\s+to\s+be\s+construed\b/i,
    /\band\s+possible\s+consideration\b/i,
    /\bentity\s*:/i,
    /\bmeeting\s+record\s+discovered\b/i,
    /\b\d{5}(?:-\d{4})?\b.*\b\d{5}(?:-\d{4})?\b/i,
    /(?:\s-\s[^-]+){4,}/,
  ].some((pattern) => pattern.test(text));
}

function meetingHighLevelSummary(event: CommunityHubEvent) {
  if (!isReaderReady(event.summary)) {
    return `A public meeting of ${event.body_name ?? event.agency ?? "a local public body"}. Open it for agenda topics and participation details.`;
  }
  return highLevelSummary(event.summary, "Open the meeting for agenda topics and participation details.");
}

function EmptyCard({ text }: { text: string }) {
  return <div className="dd-simple-card border-dashed text-sm leading-6 text-slate-400">{highLevelSummary(text, text)}</div>;
}

function Badge({ children, tone = "slate" }: { children: string; tone?: "slate" | "cyan" | "amber" | "green" }) {
  const classes = {
    slate: "border-white/10 bg-white/5 text-slate-300",
    cyan: "border-cyan-300/20 bg-cyan-500/10 text-cyan-200",
    amber: "border-amber-300/20 bg-amber-500/10 text-amber-200",
    green: "border-emerald-300/20 bg-emerald-500/10 text-emerald-200",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes[tone]}`}>{children}</span>;
}

function BriefingCard({ eyebrow, title, summary, href, badge = "source backed", tone = "cyan" }: { eyebrow: string; title: string; summary: string; href?: string | null; badge?: string; tone?: "slate" | "cyan" | "amber" | "green" }) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <Badge tone={tone}>{eyebrow}</Badge>
        <span className={`text-[11px] font-medium ${badge.includes("limited") || badge.includes("review") ? "text-amber-200" : "text-slate-500"}`}>{badge}</span>
      </div>
      <h3 className="mt-3 text-base font-semibold leading-6 text-slate-50">{plainLanguageTitle(title)}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{highLevelSummary(summary, "More information is being reviewed.", 155)}</p>
      {href ? <span className="mt-4 inline-flex text-xs font-semibold text-cyan-200">Learn more →</span> : null}
    </>
  );

  if (href?.startsWith("http")) {
    return <a href={href} target="_blank" rel="noreferrer" className="dd-simple-card block transition hover:border-cyan-300/25">{content}</a>;
  }
  if (href) {
    return <Link href={href} className="dd-simple-card block transition hover:border-cyan-300/25">{content}</Link>;
  }
  return <article className="dd-simple-card">{content}</article>;
}

function StoryCard({ record }: { record: CommunityRelationshipRecord }) {
  const destination = getStoryDestination(record);
  const title = plainLanguageTitle(record.storyHeadline ?? record.title);
  const summary = highLevelSummary(record.storySummary ?? record.title, "This local item is being reviewed.");
  const whyItMatters = highLevelSummary(record.storyWhyItMatters, "This may affect local services, rules, or public money.", 145);

  return (
    <article className="dd-simple-card">
      <Badge tone={record.needsReview ? "amber" : "cyan"}>{record.storyType ?? "local update"}</Badge>
      <h3 className="mt-3 text-base font-semibold leading-6 text-slate-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{summary}</p>
      <p className="mt-3 text-sm leading-6 text-slate-400"><span className="font-semibold text-slate-300">Why it matters:</span> {whyItMatters}</p>
      {destination.href && destination.kind === "internal" ? <Link href={destination.href} className="mt-4 inline-flex rounded-full bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100">Read more</Link> : null}
      {destination.href && destination.kind === "source" ? <a href={destination.href} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100">Read source</a> : null}
      <CivicDetails>
        <p>{record.storyJurisdiction ?? "Jurisdiction pending"} · {formatShortDate(record.date)}</p>
        <p>{record.relationshipScope.replaceAll("_", " ")} · {record.needsReview ? "review in progress" : "source backed"} · {confidenceLabel(record.confidence)}</p>
        <p className="break-words">Source: {record.storySourceDetail ?? record.storySourceLabel ?? record.sourcePath}</p>
      </CivicDetails>
    </article>
  );
}

function EventCard({ event }: { event: CommunityHubEvent }) {
  const sourceHref = event.meeting_id ? `/events/${event.meeting_id}` : event.source_url;
  const title = plainLanguageTitle(event.title);
  return (
    <article className="dd-simple-card">
      <div className="flex items-center justify-between gap-3">
        <Badge tone={event.status === "upcoming" ? "green" : "slate"}>{event.status === "upcoming" ? "Coming up" : "Past meeting"}</Badge>
        <span className="text-xs text-slate-500">{formatDate(event.start_at)}</span>
      </div>
      <h3 className="mt-3 text-base font-semibold leading-6 text-slate-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{meetingHighLevelSummary(event)}</p>
      {sourceHref?.startsWith("http") ? <a href={sourceHref} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100">View meeting</a> : <Link href={sourceHref ?? "/events"} className="mt-4 inline-flex rounded-full bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100">View meeting</Link>}
      <CivicDetails label="Meeting details">
        {title !== event.title ? <p><span className="font-semibold text-slate-300">Official title:</span> {event.title}</p> : null}
        <p>Held by {event.body_name ?? event.agency ?? "public body pending"}.</p>
        {event.related_topics.length ? <p>Topics: {event.related_topics.slice(0, 3).join(" · ")}</p> : null}
        <p>{event.public_comment_info ?? "Public-comment details have not been added yet; check the official agenda."}</p>
        <p>{event.needsReview ? "Review in progress" : "Source backed"}</p>
      </CivicDetails>
    </article>
  );
}

function ProjectCard({ project }: { project: CommunityHubProject }) {
  const rawTitle = project.name ?? project.project_title ?? project.title;
  const title = projectHeadline({
    title: rawTitle,
    description: project.description ?? project.summary,
    sourceText: project.lastPublicAction,
    responsibleBody: project.responsibleBody,
    agency: project.agency,
    jurisdiction: project.jurisdiction,
    needsReview: project.needsReview,
  });
  const summary = projectCardSummary({
    title: rawTitle,
    description: project.description ?? project.summary,
    sourceText: project.lastPublicAction,
    responsibleBody: project.responsibleBody,
    agency: project.agency,
    jurisdiction: project.jurisdiction,
    needsReview: project.needsReview,
  });
  return (
    <article className="dd-simple-card">
      <Badge tone={project.needsReview ? "amber" : "cyan"}>{project.status.replaceAll("_", " ")}</Badge>
      <h3 className="mt-3 text-base font-semibold leading-6 text-slate-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{summary}</p>
      <Link href={`/projects/${project.id}`} className="mt-4 inline-flex rounded-full bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100">View project</Link>
      <CivicDetails label="Project details">
        {title !== rawTitle ? <p><span className="font-semibold text-slate-300">Official wording:</span> {rawTitle}</p> : null}
        <p>{project.responsibleBody ?? project.agency ?? project.sourceMeetings?.[0]?.title ?? "Agency pending"}</p>
        <p>{project.cost ?? (project.budget ? `$${project.budget.toLocaleString()}` : "Cost not available")} · {formatShortDate(project.timeline ?? project.startDate)}</p>
        {project.relatedIssues?.length ? <p>Related: {project.relatedIssues.slice(0, 2).join(" · ")}</p> : null}
        <p>{project.needsReview ? "Review in progress" : "Source backed"}</p>
      </CivicDetails>
    </article>
  );
}

function DecisionCard({ decision }: { decision: CommunityHubDecision }) {
  const trust = getDecisionTrustView(decision);
  const hasAggregateOutcome = !/^no\b/i.test(decision.voteCount.display);
  const attributionStatus = decision.voteCount.totalKnown > 0 ? "roll-call parsed" : hasAggregateOutcome ? "aggregate-only" : "unavailable in current records";
  const attributionMessage =
    decision.voteCount.totalKnown > 0
      ? "Votes parsed from official roll-call record."
      : hasAggregateOutcome
        ? "Only the aggregate outcome is currently available from public records."
        : "This action needs review before individual votes can be shown.";
  const title = decisionHeadline({
    title: decision.title,
    summary: decision.summary,
    sourceText: decision.sourceReferences.map((reference) => reference.snippet).filter(Boolean).join(" "),
    bodyName: decision.meeting.bodyName,
    jurisdiction: decision.jurisdiction,
    needsReview: trust.state === "needs_review",
  });
  const summary = decisionCardSummary({
    title: decision.title,
    summary: decision.summary,
    sourceText: decision.sourceReferences.map((reference) => reference.snippet).filter(Boolean).join(" "),
    bodyName: decision.meeting.bodyName,
    jurisdiction: decision.jurisdiction,
    needsReview: trust.state === "needs_review",
  });
  return (
    <article className={`dd-simple-card ${trust.state === "needs_review" ? "border-amber-300/20 bg-amber-500/[0.04]" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <Badge tone={decision.voteOutcome === "approved" ? "green" : decision.voteOutcome === "denied" ? "amber" : "slate"}>{decision.voteOutcome}</Badge>
        <span className="text-xs text-slate-500">{formatShortDate(decision.meeting.date)}</span>
      </div>
      <h3 className="mt-3 text-base font-semibold leading-6 text-slate-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{summary}</p>
      <p className="mt-3 text-sm leading-6 text-slate-400"><span className="font-semibold text-slate-300">Why it matters:</span> {highLevelSummary(decision.whyItMatters, "It may affect local rules, services, or public money.", 150)}</p>
      <Link href={`/decisions/${decision.id}`} className="mt-4 inline-flex rounded-full bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100">See decision</Link>
      <CivicDetails label="Vote & source details">
        {title !== decision.title ? <p><span className="font-semibold text-slate-300">Official title:</span> {decision.title}</p> : null}
        <p>{decision.decisionType} · {decision.voteCount.display} · {attributionStatus}</p>
        <p>{trust.description}</p>
        <p>{attributionMessage}</p>
        <p>{decision.jurisdiction} · {decision.meeting.bodyName}</p>
        <p>{decision.financialImpact.description ?? decision.financialImpact.raw ?? "No financial impact is available"} · {confidenceLabel(decision.confidence)}</p>
      </CivicDetails>
    </article>
  );
}

function OfficialCard({ official }: { official: CommunityHubOfficial }) {
  const href = official.profile_url ?? official.source_url;
  const roleLabel = official.role_category?.replaceAll("_", " ") ?? official.level ?? "official";
  const methodLabel = official.selection_method?.replaceAll("_", " ") ?? "source backed";
  const statusLabel = official.acting_or_interim ? official.current_status?.replaceAll("_", " ") ?? "acting" : methodLabel;
  return (
    <article className="dd-simple-card">
      <div className="flex items-start gap-3">
        <CivicAvatar name={official.name} imageUrl={official.image_url} entityType="official" size="md" verified />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-50">{official.office}</h3>
          <p className="mt-1 text-sm font-medium leading-6 text-slate-300">{official.name}</p>
          <p className="mt-1 text-xs text-slate-500">{[official.body_name, official.district, official.department].filter(Boolean).join(" · ") || roleLabel}</p>
          {href ? <a href={href} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-cyan-200">View profile →</a> : null}
        </div>
      </div>
      <CivicDetails>
        <p>{roleLabel} · {statusLabel}</p>
        <p>{official.jurisdiction} · verified {formatShortDate(official.last_verified_at)}</p>
        <p>{confidenceLabel(official.confidence)} · Source: {official.source_label}</p>
        <p>Related public actions: {official.related_action_count ?? 0}</p>
      </CivicDetails>
    </article>
  );
}

function OfficialsGroup({ title, description, officials, emptyText }: { title: string; description: string; officials: CommunityHubOfficial[]; emptyText: string }) {
  if (!officials.length) return <EmptyCard text={emptyText} />;
  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-50">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {officials.map((official) => <OfficialCard key={official.id} official={official} />)}
      </div>
    </div>
  );
}

function ExpandablePanel({ eyebrow, title, description, children, id }: { eyebrow: string; title: string; description: string; children: ReactNode; id?: string }) {
  return (
    <details id={id} className="group scroll-mt-24 dd-panel rounded-[1.75rem] p-6 sm:p-8">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-5 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-xs font-semibold text-cyan-200">{eyebrow}</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-50 sm:text-2xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-lg text-slate-300 transition group-open:rotate-45">+</span>
      </summary>
      <div className="mt-6 border-t border-white/10 pt-6">{children}</div>
    </details>
  );
}

export default async function CommunityProductPage({ params }: CommunityPageProps) {
  const { communitySlug } = await params;
  const data = await getCommunityHubData(communitySlug);
  if (!data) notFound();
  const residentAnswers = await getResidentQuestionAnswersForTarget({
    targetType: "community",
    targetId: data.community.id,
    community: data.community.name,
    limit: 4,
  });
  const dataops = readGenerated<DataopsMonitoring>("dataops-monitoring-status.json", { records: [] });
  const communitySourceRecords = (dataops.records ?? []).filter((record) => {
    const jurisdiction = record.jurisdiction ?? "";
    return jurisdiction.includes(data.community.name) || data.community.name.includes(jurisdiction.replace(", NV", ""));
  });
  const sourceFreshness = {
    lastCheckedAt: dataops.generatedAt ?? data.coverageGeneratedAt,
    documentsRecovered: communitySourceRecords.reduce((sum, record) => sum + record.documentCounts.cached + record.documentCounts.extracted, 0),
    queuedDocuments: communitySourceRecords.reduce((sum, record) => sum + record.documentCounts.queued, 0),
    ocrPending: communitySourceRecords.reduce((sum, record) => sum + record.documentCounts.ocrRequired, 0),
  };

  const upcomingEvents = data.events.filter((event) => event.status === "upcoming").sort((a, b) => (Date.parse(a.start_at ?? "") || 0) - (Date.parse(b.start_at ?? "") || 0)).slice(0, 6);
  const communityName = data.community.name.toLowerCase();
  const isLocalJurisdiction = (value: string | null | undefined) => (value ?? "").toLowerCase().includes(communityName);
  const localDecisions = data.decisions.filter((decision) => isLocalJurisdiction(decision.jurisdiction) || isLocalJurisdiction(decision.meeting.bodyName));
  const localProjects = data.projects.filter((project) => isLocalJurisdiction(project.communityName) || isLocalJurisdiction(project.jurisdiction));
  const publicReadyDecisions = localDecisions.filter((decision) => getDecisionTrustView(decision).isPublicSpotlightReady);
  const recentDecisions = publicReadyDecisions.slice(0, 4);
  const limitedReviewDecisions = localDecisions.filter((decision) => !getDecisionTrustView(decision).isPublicSpotlightReady).slice(0, 4);
  const topDecision = recentDecisions.find((decision) => isReaderReady(decision.title, decision.summary, decision.whyItMatters)) ?? null;
  const topStory = data.storyRecords.find((record) =>
    !record.needsReview &&
    (record.storyJurisdiction ?? "").toLowerCase().includes(data.community.name.toLowerCase()) &&
    isReaderReady(record.storyHeadline ?? record.title, record.storySummary, record.storyWhyItMatters),
  ) ?? null;
  const topProject = localProjects.find((project) =>
    !project.needsReview &&
    ["proposed", "approved", "funded", "in_progress"].includes(project.status) &&
    isReaderReady(project.name ?? project.project_title ?? project.title, project.description ?? project.summary),
  ) ?? null;
  const nextEvent = upcomingEvents[0] ?? null;
  const limitedDataBadge = data.coverageRow?.missingCategories.length ? "limited local data" : "source backed";
  const spendingStories = data.storyRecords.filter((record) => record.storyType === "spending").slice(0, 4);
  const caseStories = data.storyRecords.filter((record) => record.storyType === "case").slice(0, 4);
  const electionStories = data.storyRecords.filter((record) => record.storyType === "election" || record.storyType === "vote").slice(0, 4);
  const governingOfficials = data.officials.filter((official) => official.role_category === "governing_body");
  const otherElectedOfficials = data.officials.filter((official) => ["elected_executive", "elected_constitutional_office", "judiciary"].includes(official.role_category ?? ""));
  const cityLeadership = data.officials.filter((official) => ["appointed_executive", "department_leadership"].includes(official.role_category ?? ""));
  const otherOfficials = data.officials.filter((official) => !governingOfficials.includes(official) && !otherElectedOfficials.includes(official) && !cityLeadership.includes(official));
  const rssItems = [
    ...(data.rssCapabilities?.seedExamples ?? []).filter((item) => item.jurisdiction.includes(data.community.name) || data.community.name.includes(item.jurisdiction.replace(", NV", ""))),
    ...(data.rssCapabilities?.rssCapableSources ?? []).filter((item) => item.jurisdiction.includes(data.community.name) || data.community.name.includes(item.jurisdiction.replace(", NV", ""))),
  ].slice(0, 3);

  return (
    <div className="space-y-8 py-8">
      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex max-w-3xl items-start gap-4">
            <CivicAvatar name={data.community.name} imageUrl={data.community.imagePath} entityType="community" size="lg" verified className="h-16 w-16 rounded-2xl sm:h-20 sm:w-20" />
            <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Community hub</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">{data.community.name}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">{data.community.descriptor}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <FavoriteToggleControl
                targetType="community"
                targetId={data.community.id}
                visibleLabel="Follow community"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-500/15"
              />
              <Link href={`/cases/submit?targetType=community&targetId=${encodeURIComponent(data.community.id)}&community=${encodeURIComponent(data.community.name)}`} className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100">
                Ask a question or report concern
              </Link>
              <Link href="/profile" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100">
                View watchlist
              </Link>
            </div>
            </div>
          </div>
        </div>
        <CivicDetails label="About this page's data">
          <p>{data.kind} · {data.coverageRow?.dashboardCounts.useful ?? 0} linked civic records · generated {formatShortDate(data.coverageGeneratedAt)}</p>
          <p>Sources last checked {formatShortDate(sourceFreshness.lastCheckedAt)} · {sourceFreshness.documentsRecovered} documents recovered.</p>
          {data.coverageRow?.missingCategories.length ? <p>Coverage is still limited for: {data.coverageRow.missingCategories.join(", ")}.</p> : null}
          {sourceFreshness.queuedDocuments ? <p>{sourceFreshness.queuedDocuments} documents are awaiting retrieval.</p> : null}
          {sourceFreshness.ocrPending ? <p>{sourceFreshness.ocrPending} documents await text extraction or manual review.</p> : null}
        </CivicDetails>
      </section>

      <CommunityPageNav />

      <section id="briefing" className="scroll-mt-24 dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading
          eyebrow="Resident briefing"
          title="What should I pay attention to?"
          description="Four quick things to know. Open only what interests you."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <BriefingCard
            eyebrow="happening"
            title={topStory?.storyHeadline ?? topDecision?.title ?? "No major reviewed update yet"}
            summary={topStory?.storySummary ?? topDecision?.summary ?? "We are still reviewing local records before highlighting a major development."}
            href={topStory ? getStoryDestination(topStory).href : topDecision ? `/decisions/${topDecision.id}` : null}
            badge={topStory?.needsReview ? "needs review" : limitedDataBadge}
            tone="cyan"
          />
          <BriefingCard
            eyebrow="changed"
            title={topDecision?.title ?? "No reviewed decision is ready yet"}
            summary={topDecision ? `${topDecision.voteOutcome} · ${topDecision.voteCount.display}. ${topDecision.whyItMatters}` : "When a reviewed vote, ordinance, spending item, or action is parsed, it will appear here first."}
            href={topDecision ? `/decisions/${topDecision.id}` : null}
            badge={topDecision ? getDecisionTrustView(topDecision).shortLabel : limitedDataBadge}
            tone={topDecision && getDecisionTrustView(topDecision).state === "needs_review" ? "amber" : "green"}
          />
          <BriefingCard
            eyebrow="watch"
            title={topProject?.name ?? topProject?.project_title ?? "No major project is ready to highlight"}
            summary={topProject ? `${topProject.status}. ${topProject.lastPublicAction ?? topProject.description ?? topProject.summary}` : "Projects appear when spending, contracts, capital work, or major initiatives can be connected to official actions."}
            href={topProject ? `/projects/${topProject.id}` : null}
            badge={topProject?.needsReview ? "needs review" : topProject ? "source backed" : limitedDataBadge}
            tone="amber"
          />
          <BriefingCard
            eyebrow="next"
            title={nextEvent?.title ?? "No upcoming meeting is parsed yet"}
            summary={nextEvent ? `${formatDate(nextEvent.start_at)}. ${meetingHighLevelSummary(nextEvent)}` : "Upcoming meetings appear when an official agenda or calendar is available."}
            href={nextEvent?.meeting_id ? `/events/${nextEvent.meeting_id}` : nextEvent?.source_url ?? null}
            badge={nextEvent?.needsReview ? "needs review" : nextEvent ? "source backed" : limitedDataBadge}
            tone="green"
          />
        </div>
      </section>

      <ExpandablePanel
        eyebrow="Questions"
        title="Answers from local public sources"
        description="Optional: open this when you want reviewed answers to resident questions."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {residentAnswers.length ? (
            residentAnswers.map((answer) => (
              <article key={answer.id} className="dd-simple-card">
                <Badge tone="green">Reviewed answer</Badge>
                <h3 className="mt-3 text-base font-semibold text-slate-50">{plainLanguageTitle(answer.questionTitle)}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{highLevelSummary(answer.answerSummary, "A reviewed answer is available.")}</p>
                {answer.sourceUrl ? (
                  <a href={answer.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                    Open source
                  </a>
                ) : null}
                <CivicDetails><p>Routed to {answer.recipientName ?? "reviewed civic body"} · {answer.recipientType.replaceAll("_", " ")}</p></CivicDetails>
              </article>
            ))
          ) : (
            <EmptyCard text="No reviewed resident answers are linked to this community yet. Residents can ask questions, but answers appear only after moderation and routing review." />
          )}
        </div>
        <Link href="/answers" className="mt-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100">
          View all reviewed answers
        </Link>
      </ExpandablePanel>

      <ExpandablePanel eyebrow="Local context" title="More stories worth knowing" description="Optional background on local spending, cases, elections, and public actions.">
        <div className="grid gap-4 lg:grid-cols-2">
          {data.storyRecords.length ? data.storyRecords.slice(0, 4).map((record) => <StoryCard key={`${record.id}-${record.linkType}`} record={record} />) : <EmptyCard text="No reviewed civic stories are available yet." />}
        </div>
      </ExpandablePanel>

      <section id="events" className="scroll-mt-24 dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading eyebrow="Next meetings" title="What can I join or watch?" description="Upcoming public meetings where residents may be able to attend, watch, or comment." />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {upcomingEvents.slice(0, 4).length ? upcomingEvents.slice(0, 4).map((event) => <EventCard key={event.id} event={event} />) : <EmptyCard text="No upcoming local events are currently parsed. Check source links and statewide records for broader activity." />}
        </div>
      </section>

      <section id="decisions" className="scroll-mt-24 dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading eyebrow="Recent decisions" title="What did local government decide?" description="Short summaries first. Vote records and official source language are available inside each card." />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {recentDecisions.length ? recentDecisions.map((decision) => <DecisionCard key={decision.id} decision={decision} />) : <EmptyCard text="No source-backed decision cards are currently generated for this community." />}
        </div>
        {limitedReviewDecisions.length ? (
          <CivicDetails label={`${limitedReviewDecisions.length} more decisions still under review`} className="mt-6">
            <p className="mb-4">These have official-source signals, but some details still need review.</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {limitedReviewDecisions.map((decision) => <DecisionCard key={decision.id} decision={decision} />)}
            </div>
          </CivicDetails>
        ) : null}
      </section>

      <ExpandablePanel eyebrow="Projects" title="What is the city working on?" description="Open for major construction, spending, and public-work updates.">
        <div className="grid gap-4 lg:grid-cols-2">
          {localProjects.length ? localProjects.slice(0, 4).map((project) => <ProjectCard key={project.id} project={project} />) : <EmptyCard text="No reviewed Carson City project records are available yet." />}
        </div>
      </ExpandablePanel>

      <ExpandablePanel id="more" eyebrow="Accountability" title="How much public information do we have?" description="Optional: counts showing decisions, votes, projects, and gaps in the public record.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Recent decisions", data.accountabilityScoreboard.recentDecisions],
            ["Reviewed decisions", data.accountabilityScoreboard.approvedDecisions],
            ["Active projects", data.accountabilityScoreboard.activeProjects],
            ["Votes parsed", data.accountabilityScoreboard.votesParsed],
          ].map(([label, value]) => (
            <div key={label} className="dd-simple-card">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-lg font-semibold text-slate-50">{value}</p>
            </div>
          ))}
        </div>
        <CivicDetails label="All accountability data">
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {[
              ["Source-backed previews", data.accountabilityScoreboard.readyDecisions],
              ["Decisions needing review", data.accountabilityScoreboard.decisionsNeedingReview],
              ["Projects without a recent update", data.accountabilityScoreboard.projectsWithNoRecentUpdate],
              ["Votes needing review", data.accountabilityScoreboard.votesNeedingRollCallReview],
              ["Attendance verified", data.accountabilityScoreboard.attendanceVerifiedVoteActions],
              ["Attendance missing", data.accountabilityScoreboard.voteActionsMissingAttendance],
              ["Vote distribution review", data.accountabilityScoreboard.voteActionsNeedingDistributionReview],
              ["Attendance-inferred votes", data.accountabilityScoreboard.votesInferredFromAttendance],
              ["Resident concerns pending", data.accountabilityScoreboard.residentConcernsPendingReview],
              ["Officials involved", data.accountabilitySummary?.officialsInvolved ?? recentDecisions.reduce((sum, decision) => sum + decision.relatedOfficials.length, 0)],
              ["Spending approved", data.accountabilitySummary?.spendingApproved ? `$${data.accountabilitySummary.spendingApproved.toLocaleString()}` : "Review needed"],
            ].map(([label, value]) => <p key={label} className="flex justify-between gap-3"><span>{label}</span><strong className="text-slate-300">{value}</strong></p>)}
          </div>
          <div className="mt-5">
            <p className="font-semibold text-slate-300">Public bodies connected to the most actions</p>
            <div className="mt-3 space-y-2">
              {data.accountabilityScoreboard.topActionBodies.length ? (
                data.accountabilityScoreboard.topActionBodies.map((body) => (
                  <div key={body.name} className="flex items-center justify-between gap-3 text-sm text-slate-300">
                    <span>{body.name}</span>
                    <span className="font-semibold text-slate-100">{body.count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No source-backed action bodies are connected yet.</p>
              )}
            </div>
          </div>
          <p className="mt-4">Individual votes appear only when attendance and roll-call records support them. Unverified resident submissions remain private.</p>
          {data.accountabilitySummary?.lastActivityAt ? <p className="mt-2">Last activity: {formatShortDate(data.accountabilitySummary.lastActivityAt)}</p> : null}
        </CivicDetails>
      </ExpandablePanel>

      <ExpandablePanel eyebrow="Data details" title="Why some votes do not name each official" description="For readers who want to understand source completeness and attribution limits.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Meetings imported", data.civicDataCoverage.meetingsImported],
            ["With minutes", data.civicDataCoverage.meetingsWithMinutes],
            ["With attendance", data.civicDataCoverage.meetingsWithAttendance],
            ["With vote outcomes", data.civicDataCoverage.meetingsWithVoteOutcomes],
            ["Named votes", data.civicDataCoverage.namedVotes],
            ["Attendance validated", data.civicDataCoverage.attendanceValidatedVotes],
            ["Aggregate outcome only", data.civicDataCoverage.aggregateOnlyVotes],
            ["Projects awaiting updates", data.civicDataCoverage.projectsAwaitingUpdates],
          ].map(([label, value]) => (
            <div key={label} className="dd-simple-card">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-lg font-semibold text-slate-50">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          We show that an item passed when the source supports it. We name individual votes only when attendance and roll-call records are clear.
        </p>
      </ExpandablePanel>

      <section id="officials" className="scroll-mt-24 dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading eyebrow="Local officials" title="Who represents or runs the city?" description="Start with elected officials. Appointed leadership appears below when verified." />
        <div className="mt-6 space-y-8">
          <OfficialsGroup
            title="Your elected city leaders"
            description="The mayor and governing-board members who make city decisions."
            officials={governingOfficials}
            emptyText="Current governing officials have not yet been verified from an official source."
          />
          {otherElectedOfficials.length || cityLeadership.length || otherOfficials.length ? (
            <CivicDetails label="More elected and appointed officials">
              <div className="space-y-8 pt-2">
                {otherElectedOfficials.length ? <OfficialsGroup title="Other elected offices" description="Other locally relevant elected and judicial offices." officials={otherElectedOfficials} emptyText="No other elected offices are available." /> : null}
                {cityLeadership.length ? <OfficialsGroup title="Appointed city leadership" description="Department and administrative leaders who are not elected." officials={cityLeadership} emptyText="No appointed leadership is available." /> : null}
                {otherOfficials.length ? <OfficialsGroup title="Other public officials" description="Additional verified public officials." officials={otherOfficials} emptyText="No other officials are available." /> : null}
              </div>
            </CivicDetails>
          ) : null}
        </div>
      </section>

      <ExpandablePanel eyebrow="More local records" title="Spending, courts, elections, and notices" description="Optional source-backed records for deeper research.">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-50">Public spending</h3>
            <p className="mt-1 text-sm text-slate-400">Budgets, grants, contracts, and fees.</p>
            <div className="mt-4 space-y-4">{spendingStories.length ? spendingStories.map((record) => <StoryCard key={`${record.id}-${record.linkType}`} record={record} />) : <EmptyCard text="No reviewed local spending stories are available." />}</div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-50">Public court cases</h3>
            <p className="mt-1 text-sm text-slate-400">Reviewed cases connected to this community.</p>
            <div className="mt-4 space-y-4">
              {caseStories.length ? caseStories.map((record) => <StoryCard key={`${record.id}-${record.linkType}`} record={record} />) : <EmptyCard text="No reviewed local court cases are available." />}
              <Link href="/cases/lead" className="inline-flex text-sm font-semibold text-cyan-200">Submit a public case lead →</Link>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-50">Elections</h3>
            <p className="mt-1 text-sm text-slate-400">Election and voting records connected to this community.</p>
            <div className="mt-4 space-y-4">{electionStories.length ? electionStories.map((record) => <StoryCard key={`${record.id}-${record.linkType}`} record={record} />) : <EmptyCard text="No local election records are available yet." />}</div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-50">Official notices</h3>
            <p className="mt-1 text-sm text-slate-400">Updates published by public agencies.</p>
            <div className="mt-4 space-y-4">
              {rssItems.length ? rssItems.map((item) => (
                <a key={item.id} href={"rssUrl" in item ? item.rssUrl : item.sourceUrl ?? "#"} target="_blank" rel="noreferrer" className="dd-simple-card block">
                  <h3 className="text-base font-semibold text-slate-50">{item.sourceName}</h3>
                  <p className="mt-2 text-sm text-slate-400">Official updates for {item.jurisdiction}.</p>
                </a>
              )) : <EmptyCard text="No official notice feed is attached yet." />}
            </div>
          </div>
        </div>
      </ExpandablePanel>
    </div>
  );
}
