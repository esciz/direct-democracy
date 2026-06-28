import Link from "next/link";
import { notFound } from "next/navigation";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { SectionHeading } from "@/components/ui/section-heading";
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

function EmptyCard({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">{text}</div>;
}

function Badge({ children, tone = "slate" }: { children: string; tone?: "slate" | "cyan" | "amber" | "green" }) {
  const classes = {
    slate: "border-white/10 bg-white/5 text-slate-300",
    cyan: "border-cyan-300/20 bg-cyan-500/10 text-cyan-200",
    amber: "border-amber-300/20 bg-amber-500/10 text-amber-200",
    green: "border-emerald-300/20 bg-emerald-500/10 text-emerald-200",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${classes[tone]}`}>{children}</span>;
}

function BriefingCard({ eyebrow, title, summary, href, badge = "source backed", tone = "cyan" }: { eyebrow: string; title: string; summary: string; href?: string | null; badge?: string; tone?: "slate" | "cyan" | "amber" | "green" }) {
  const content = (
    <>
      <div className="flex flex-wrap gap-2">
        <Badge tone={tone}>{eyebrow}</Badge>
        <Badge tone={badge.includes("limited") || badge.includes("review") ? "amber" : "green"}>{badge}</Badge>
      </div>
      <h3 className="mt-3 text-base font-semibold leading-6 text-slate-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{summary}</p>
    </>
  );

  if (href?.startsWith("http")) {
    return <a href={href} target="_blank" rel="noreferrer" className="block rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/25 hover:bg-white/[0.06]">{content}</a>;
  }
  if (href) {
    return <Link href={href} className="block rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/25 hover:bg-white/[0.06]">{content}</Link>;
  }
  return <article className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">{content}</article>;
}

function StoryCard({ record }: { record: CommunityRelationshipRecord }) {
  const destination = getStoryDestination(record);
  const content = (
    <>
      <div className="flex flex-wrap gap-2">
        <Badge tone="cyan">{record.storyType ?? "story"}</Badge>
        <Badge>{record.relationshipScope.replaceAll("_", " ")}</Badge>
        {record.needsReview ? <Badge tone="amber">needs review</Badge> : <Badge tone="green">source backed</Badge>}
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-50">{record.storyHeadline ?? record.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{record.storySummary ?? record.title}</p>
      <p className="mt-3 text-sm leading-6 text-slate-400">Why it matters: {record.storyWhyItMatters ?? "This may affect residents, services, rules, oversight, or public resources."}</p>
      <div className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-slate-500">
        <p>{record.storyJurisdiction ?? "Jurisdiction pending"} · {confidenceLabel(record.confidence)} · {formatShortDate(record.date)}</p>
        <p>Source: {record.storySourceDetail ?? record.storySourceLabel ?? record.sourcePath}</p>
      </div>
      <span className="mt-3 inline-flex text-xs font-semibold text-cyan-200">{destination.kind === "source" ? "Source" : destination.kind === "internal" ? "Open" : "Destination pending"}</span>
    </>
  );

  if (destination.href && destination.kind === "internal") {
    return <Link href={destination.href} className="block rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/25 hover:bg-white/[0.06]">{content}</Link>;
  }
  if (destination.href) {
    return <a href={destination.href} target="_blank" rel="noreferrer" className="block rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/25 hover:bg-white/[0.06]">{content}</a>;
  }
  return <article className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">{content}</article>;
}

function EventCard({ event }: { event: CommunityHubEvent }) {
  const sourceHref = event.meeting_id ? `/events/${event.meeting_id}` : event.source_url;
  const content = (
    <>
      <div className="flex flex-wrap gap-2">
        <Badge tone={event.status === "upcoming" ? "green" : "slate"}>{event.status}</Badge>
        {event.needsReview ? <Badge tone="amber">needs review</Badge> : <Badge tone="green">source backed</Badge>}
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-50">{event.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{event.summary}</p>
      <p className="mt-3 text-sm leading-6 text-slate-400">Held by {event.body_name ?? event.agency ?? "public body pending"} on {formatDate(event.start_at)}.</p>
      {event.related_topics.length ? <p className="mt-2 text-xs leading-5 text-slate-500">Topics: {event.related_topics.slice(0, 3).join(" · ")}</p> : null}
      <p className="mt-2 text-xs leading-5 text-slate-500">{event.public_comment_info ?? "Public comment details are not parsed yet; review the source agenda when available."}</p>
    </>
  );
  return sourceHref?.startsWith("http") ? <a href={sourceHref} target="_blank" rel="noreferrer" className="block rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">{content}</a> : <Link href={sourceHref ?? "/events"} className="block rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">{content}</Link>;
}

function ProjectCard({ project }: { project: CommunityHubProject }) {
  return (
    <Link href={`/projects/${project.id}`} className="block rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/25 hover:bg-white/[0.06]">
      <div className="flex flex-wrap gap-2">
        <Badge tone="cyan">project</Badge>
        {project.needsReview ? <Badge tone="amber">needs review</Badge> : <Badge tone="green">source backed</Badge>}
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-50">{project.name ?? project.project_title ?? project.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{project.description ?? project.summary}</p>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        {project.agency ?? project.sourceMeetings?.[0]?.title ?? "Agency pending"} · {project.status} · {project.cost ?? (project.budget ? `$${project.budget.toLocaleString()}` : "Cost not parsed")} · {formatShortDate(project.timeline ?? project.startDate)}
      </p>
      {project.relatedIssues?.length ? <p className="mt-2 text-xs leading-5 text-slate-500">Related issue: {project.relatedIssues.slice(0, 2).join(" · ")}</p> : null}
    </Link>
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
  return (
    <Link href={`/decisions/${decision.id}`} className={`block rounded-[1.35rem] border p-4 transition hover:border-cyan-300/25 hover:bg-white/[0.06] ${trust.state === "needs_review" ? "border-amber-300/20 bg-amber-500/[0.06]" : "border-white/10 bg-white/[0.04]"}`}>
      <div className="flex flex-wrap gap-2">
        <Badge tone="cyan">decision</Badge>
        <Badge tone="cyan">{decision.decisionType}</Badge>
        <Badge tone={trust.tone}>{trust.label}</Badge>
        <Badge tone={decision.voteOutcome === "approved" ? "green" : decision.voteOutcome === "denied" ? "amber" : "slate"}>{decision.voteOutcome}</Badge>
        <Badge>{decision.voteCount.display}</Badge>
        <Badge tone={decision.voteCount.totalKnown > 0 ? "green" : hasAggregateOutcome ? "amber" : "slate"}>{attributionStatus}</Badge>
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Question for residents</p>
      <h3 className="mt-3 text-base font-semibold text-slate-50">{decision.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{decision.summary}</p>
      <p className="mt-3 text-sm leading-6 text-slate-400">Impact: {decision.whyItMatters}</p>
      <p className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${trust.state === "approved" ? "border-emerald-300/15 bg-emerald-500/10 text-emerald-100" : trust.state === "ready" ? "border-cyan-300/15 bg-cyan-500/10 text-cyan-100" : "border-amber-300/20 bg-amber-500/10 text-amber-100"}`}>
        {trust.description}
      </p>
      <p className="mt-3 rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2 text-xs leading-5 text-slate-400">{attributionMessage}</p>
      <div className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-slate-500">
        <p>{decision.jurisdiction} · {decision.meeting.bodyName} · {formatShortDate(decision.meeting.date)}</p>
        <p>{decision.financialImpact.description ?? decision.financialImpact.raw ?? "No financial impact parsed"} · {confidenceLabel(decision.confidence)}</p>
      </div>
    </Link>
  );
}

function OfficialCard({ official }: { official: CommunityHubOfficial }) {
  const href = official.profile_url ?? official.source_url;
  const roleLabel = official.role_category?.replaceAll("_", " ") ?? official.level ?? "official";
  const methodLabel = official.selection_method?.replaceAll("_", " ") ?? "source backed";
  const statusLabel = official.acting_or_interim ? official.current_status?.replaceAll("_", " ") ?? "acting" : methodLabel;
  const content = (
    <>
      <div className="flex flex-wrap gap-2">
        <Badge tone="cyan">{roleLabel}</Badge>
        <Badge tone={official.selection_method === "elected" ? "green" : official.acting_or_interim ? "amber" : "slate"}>{statusLabel}</Badge>
        <Badge tone="green">source backed</Badge>
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-50">{official.name}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{official.office}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        {[official.district, official.department].filter(Boolean).join(" · ") || "Office details verified from source"}
      </p>
      <p className="mt-3 text-xs leading-5 text-slate-500">{official.jurisdiction} · verified {formatShortDate(official.last_verified_at)}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{confidenceLabel(official.confidence)} · Source: {official.source_label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Related parsed actions: {official.related_action_count ?? 0}</p>
    </>
  );
  return href ? <a href={href} target="_blank" rel="noreferrer" className="block rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">{content}</a> : <article className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">{content}</article>;
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

export default async function CommunityProductPage({ params }: CommunityPageProps) {
  const { communitySlug } = await params;
  const data = await getCommunityHubData(communitySlug);
  if (!data) notFound();
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
    hasLimitedCoverage: communitySourceRecords.some((record) => record.healthStatus === "stale" || record.healthStatus === "degraded" || record.healthStatus === "blocked"),
  };

  const upcomingEvents = data.events.filter((event) => event.status === "upcoming").sort((a, b) => (Date.parse(a.start_at ?? "") || 0) - (Date.parse(b.start_at ?? "") || 0)).slice(0, 6);
  const completedEvents = data.events.filter((event) => event.status === "completed").sort((a, b) => (Date.parse(b.start_at ?? "") || 0) - (Date.parse(a.start_at ?? "") || 0)).slice(0, 6);
  const publicReadyDecisions = data.decisions.filter((decision) => getDecisionTrustView(decision).isPublicSpotlightReady);
  const recentDecisions = publicReadyDecisions.slice(0, 8);
  const limitedReviewDecisions = data.decisions.filter((decision) => !getDecisionTrustView(decision).isPublicSpotlightReady).slice(0, 4);
  const topDecision = recentDecisions[0] ?? data.decisions[0] ?? null;
  const topStory = data.storyRecords[0] ?? null;
  const topProject = data.projects.find((project) => ["proposed", "approved", "funded", "in_progress"].includes(project.status)) ?? data.projects[0] ?? null;
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
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Community hub</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">{data.community.name}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">{data.community.descriptor}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Coverage</p>
            <p className="mt-2 font-semibold text-slate-100">{data.kind} · {data.coverageRow?.dashboardCounts.useful ?? 0} linked civic records</p>
            <p className="mt-1 text-xs text-slate-500">Generated {formatShortDate(data.coverageGeneratedAt)}</p>
            <p className="mt-1 text-xs text-slate-500">Source last checked {formatShortDate(sourceFreshness.lastCheckedAt)}</p>
          </div>
        </div>
        {data.coverageRow?.missingCategories.length ? (
          <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            Limited data: missing reviewed local {data.coverageRow.missingCategories.join(", ")} coverage. Broader Nevada records may still affect residents here.
          </div>
        ) : null}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-400">
          Source freshness: {sourceFreshness.documentsRecovered} source documents recovered for related monitored sources.
          {sourceFreshness.queuedDocuments ? ` ${sourceFreshness.queuedDocuments} documents are awaiting retrieval.` : " No queued source documents are currently attached to this community."}
          {sourceFreshness.ocrPending ? ` ${sourceFreshness.ocrPending} documents await OCR/manual review.` : ""}
          {sourceFreshness.hasLimitedCoverage ? " Source coverage is limited while retrieval and extraction continue." : ""}
        </div>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading
          eyebrow="Resident briefing"
          title="What should I pay attention to?"
          description="A plain-language first pass across decisions, meetings, projects, and source coverage for this community."
        />
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          <BriefingCard
            eyebrow="happening"
            title={topStory?.storyHeadline ?? topDecision?.title ?? "Local civic activity is still being organized"}
            summary={topStory?.storySummary ?? topDecision?.summary ?? "Direct Democracy has the community page ready, but reviewed local story records are still limited."}
            href={topStory ? getStoryDestination(topStory).href : topDecision ? `/decisions/${topDecision.id}` : null}
            badge={topStory?.needsReview ? "needs review" : limitedDataBadge}
            tone="cyan"
          />
          <BriefingCard
            eyebrow="changed"
            title={topDecision?.title ?? "No recent reviewed decision is available yet"}
            summary={topDecision ? `${topDecision.voteOutcome} · ${topDecision.voteCount.display}. ${topDecision.whyItMatters}` : "When a reviewed vote, ordinance, spending item, or action is parsed, it will appear here first."}
            href={topDecision ? `/decisions/${topDecision.id}` : null}
            badge={topDecision ? getDecisionTrustView(topDecision).shortLabel : limitedDataBadge}
            tone={topDecision && getDecisionTrustView(topDecision).state === "needs_review" ? "amber" : "green"}
          />
          <BriefingCard
            eyebrow="watch"
            title={topProject?.name ?? topProject?.project_title ?? "No active project is highlighted yet"}
            summary={topProject ? `${topProject.status}. ${topProject.lastPublicAction ?? topProject.description ?? topProject.summary}` : "Projects appear when spending, contracts, capital work, or major initiatives can be connected to official actions."}
            href={topProject ? `/projects/${topProject.id}` : null}
            badge={topProject?.needsReview ? "needs review" : topProject ? "source backed" : limitedDataBadge}
            tone="amber"
          />
          <BriefingCard
            eyebrow="next"
            title={nextEvent?.title ?? "No upcoming meeting is parsed yet"}
            summary={nextEvent ? `${formatDate(nextEvent.start_at)} · ${nextEvent.body_name ?? nextEvent.agency ?? "Public body pending"}. ${nextEvent.summary}` : "Upcoming events appear when agendas or meeting records are imported from official public sources."}
            href={nextEvent?.meeting_id ? `/events/${nextEvent.meeting_id}` : nextEvent?.source_url ?? null}
            badge={nextEvent?.needsReview ? "needs review" : nextEvent ? "source backed" : limitedDataBadge}
            tone="green"
          />
        </div>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading eyebrow="Pay attention first" title="Most important civic stories" description="Prioritized by local relevance, upcoming actions, projects, spending, cases, officials, and elections." />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {data.storyRecords.length ? data.storyRecords.slice(0, 8).map((record) => <StoryCard key={`${record.id}-${record.linkType}`} record={record} />) : <EmptyCard text="No reviewed civic stories are available yet." />}
        </div>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading eyebrow="Upcoming events" title="What is coming next?" description="Public meetings and civic events residents may be able to attend, watch, or comment on." />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {upcomingEvents.length ? upcomingEvents.map((event) => <EventCard key={event.id} event={event} />) : <EmptyCard text="No upcoming local events are currently parsed. Check source links and statewide records for broader activity." />}
        </div>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading eyebrow="Recent decisions" title="What changed recently?" description="Completed meetings, source-backed decisions, and meeting records with citizen-readable summaries." />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {recentDecisions.length ? recentDecisions.map((decision) => <DecisionCard key={decision.id} decision={decision} />) : <EmptyCard text="No source-backed decision cards are currently generated for this community." />}
        </div>
        {limitedReviewDecisions.length ? (
          <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="amber">limited data</Badge>
              <p className="text-sm font-semibold text-amber-100">Some related decisions are still being reviewed.</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-amber-100/90">
              These items have official-source signals, but extraction or review gaps keep them out of the main decision spotlight.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {limitedReviewDecisions.map((decision) => <DecisionCard key={decision.id} decision={decision} />)}
            </div>
          </div>
        ) : null}
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading eyebrow="Projects" title="Active projects and capital work" description="Project leads inferred from source-backed agenda and budget records. Review badges stay visible when confidence is limited." />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {data.projects.length ? data.projects.slice(0, 6).map((project) => <ProjectCard key={project.id} project={project} />) : <EmptyCard text="No reviewed local project records currently available." />}
        </div>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading eyebrow="Accountability" title="Who voted, what passed, and what it connects to" description="Graph-backed counts connect meetings, agenda items, decisions, votes, outcomes, spending, projects, and issues." />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Recent decisions", data.accountabilityScoreboard.recentDecisions],
            ["Reviewed decisions", data.accountabilityScoreboard.approvedDecisions],
            ["Source-backed previews", data.accountabilityScoreboard.readyDecisions],
            ["Decisions needing review", data.accountabilityScoreboard.decisionsNeedingReview],
            ["Active projects", data.accountabilityScoreboard.activeProjects],
            ["No recent project update", data.accountabilityScoreboard.projectsWithNoRecentUpdate],
            ["Votes parsed", data.accountabilityScoreboard.votesParsed],
            ["Votes needing review", data.accountabilityScoreboard.votesNeedingRollCallReview],
            ["Attendance verified", data.accountabilityScoreboard.attendanceVerifiedVoteActions],
            ["Attendance missing", data.accountabilityScoreboard.voteActionsMissingAttendance],
            ["Distribution review", data.accountabilityScoreboard.voteActionsNeedingDistributionReview],
            ["Attendance-inferred votes", data.accountabilityScoreboard.votesInferredFromAttendance],
            ["Resident concerns pending", data.accountabilityScoreboard.residentConcernsPendingReview],
            ["Officials involved", data.accountabilitySummary?.officialsInvolved ?? recentDecisions.reduce((sum, decision) => sum + decision.relatedOfficials.length, 0)],
            ["Spending approved", data.accountabilitySummary?.spendingApproved ? `$${data.accountabilitySummary.spendingApproved.toLocaleString()}` : "Review needed"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-lg font-semibold text-slate-50">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bodies connected to the most actions</p>
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
          <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            Data coverage note: roll-call rows are shown when named officials are present in source text. Aggregate outcomes stay visible, but individual attribution requires verified attendance; attendance-missing and distribution-review items remain review-gated. Resident stories remain private pending review and are not treated as verified civic facts.
          </div>
        </div>
        {data.accountabilitySummary?.lastActivityAt ? <p className="mt-4 text-xs text-slate-500">Last graph activity: {formatShortDate(data.accountabilitySummary.lastActivityAt)}</p> : null}
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading eyebrow="Civic data coverage" title="Why some votes can or cannot be attributed" description="Source completeness indicators show which records are imported, which have minutes or attendance, and where aggregate outcomes remain attribution-limited." />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-lg font-semibold text-slate-50">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Aggregate actions stay visible even when individual votes are unavailable. If a record says an item passed but lacks verified attendance or a resolvable vote distribution, the action remains source-backed and attribution-limited.
        </p>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading eyebrow="Officials" title="Officials & City Leadership" description="Current officeholders are shown from compact source-backed runtime records. Historical votes and actions remain separate." />
        <div className="mt-6 space-y-8">
          <OfficialsGroup
            title="Your Elected Governing Officials"
            description="Mayor and ward supervisors or equivalent governing-body members when verified."
            officials={governingOfficials}
            emptyText="Current governing officials have not yet been verified from an official source."
          />
          {otherElectedOfficials.length ? (
            <OfficialsGroup
              title="Other Elected Offices"
              description="Other source-verified elected offices and judicial offices where product policy includes them."
              officials={otherElectedOfficials}
              emptyText="No reviewed other elected offices currently available."
            />
          ) : null}
          {cityLeadership.length ? (
            <OfficialsGroup
              title="City Leadership"
              description="Appointed, acting, and department leadership are shown separately from elected officials."
              officials={cityLeadership}
              emptyText="No reviewed appointed leadership currently available."
            />
          ) : null}
          {otherOfficials.length ? (
            <OfficialsGroup
              title="Other Officials"
              description="Additional reviewed public officials that do not fit the primary groups."
              officials={otherOfficials}
              emptyText="No other reviewed officials currently available."
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
          <SectionHeading eyebrow="Spending" title="Budget and fiscal signals" description="Spending stories are shown when source records mention budget, grants, contracts, fees, or fiscal impact." />
          <div className="mt-6 space-y-4">{spendingStories.length ? spendingStories.map((record) => <StoryCard key={`${record.id}-${record.linkType}`} record={record} />) : <EmptyCard text="No reviewed local spending stories currently available." />}</div>
        </div>
        <div className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
          <SectionHeading eyebrow="Cases" title="Court cases and case leads" description="Reviewed public cases appear here. Residents can also flag public case leads for later source verification." />
          <div className="mt-6 space-y-4">
            {caseStories.length ? caseStories.map((record) => <StoryCard key={`${record.id}-${record.linkType}`} record={record} />) : <EmptyCard text="No reviewed local court cases currently available." />}
            <Link href="/cases/lead" className="block rounded-[1.35rem] border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-100">
              Know about a public case? Submit a case number, court, jurisdiction, and public source link. Nothing publishes until public records are verified.
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
          <SectionHeading eyebrow="Elections" title="Votes and election signals" description="Existing election and voting-card relationships appear here when available." />
          <div className="mt-6 space-y-4">{electionStories.length ? electionStories.map((record) => <StoryCard key={`${record.id}-${record.linkType}`} record={record} />) : <EmptyCard text="Election data acquisition needed for this community." />}</div>
        </div>
        <div className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
          <SectionHeading eyebrow="Official updates" title="News, RSS, and public notices" description="RSS is supplemental and source-backed; it does not replace agendas, minutes, budgets, elections, or court records." />
          <div className="mt-6 space-y-4">
            {rssItems.length ? rssItems.map((item) => (
              <a key={item.id} href={"rssUrl" in item ? item.rssUrl : item.sourceUrl ?? "#"} target="_blank" rel="noreferrer" className="block rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
                <Badge tone="cyan">RSS</Badge>
                <h3 className="mt-3 text-base font-semibold text-slate-50">{item.sourceName}</h3>
                <p className="mt-2 text-sm text-slate-400">Supplemental official updates for {item.jurisdiction}.</p>
              </a>
            )) : <EmptyCard text="No reviewed RSS/public notice source is attached to this community yet." />}
          </div>
        </div>
      </section>
    </div>
  );
}
