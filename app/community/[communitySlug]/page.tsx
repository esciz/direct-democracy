import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionHeading } from "@/components/ui/section-heading";
import { getCommunityHubData, getStoryDestination, type CommunityHubDecision, type CommunityHubEvent, type CommunityHubOfficial, type CommunityHubProject } from "@/lib/community/product-hub";
import type { CommunityRelationshipRecord } from "@/lib/community/relationships";

type CommunityPageProps = {
  params: Promise<{
    communitySlug: string;
  }>;
};

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
  return (
    <Link href={decision.meeting.href} className="block rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/25 hover:bg-white/[0.06]">
      <div className="flex flex-wrap gap-2">
        <Badge tone="cyan">{decision.decisionType}</Badge>
        <Badge tone={decision.voteOutcome === "approved" ? "green" : decision.voteOutcome === "denied" ? "amber" : "slate"}>{decision.voteOutcome}</Badge>
        <Badge>{decision.voteCount.display}</Badge>
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-50">{decision.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{decision.summary}</p>
      <p className="mt-3 text-sm leading-6 text-slate-400">Impact: {decision.whyItMatters}</p>
      <div className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-slate-500">
        <p>{decision.jurisdiction} · {decision.meeting.bodyName} · {formatShortDate(decision.meeting.date)}</p>
        <p>{decision.financialImpact.description ?? decision.financialImpact.raw ?? "No financial impact parsed"} · {confidenceLabel(decision.confidence)}</p>
      </div>
    </Link>
  );
}

function OfficialCard({ official }: { official: CommunityHubOfficial }) {
  const href = official.profile_url ?? official.source_url;
  const content = (
    <>
      <div className="flex flex-wrap gap-2">
        <Badge tone="cyan">{official.level ?? "official"}</Badge>
        <Badge tone="green">source backed</Badge>
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-50">{official.name}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{official.office}</p>
      <p className="mt-3 text-xs leading-5 text-slate-500">{official.jurisdiction} · {official.district ?? "Seat pending"} · verified {formatShortDate(official.last_verified_at)}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{confidenceLabel(official.confidence)} · Source: {official.source_label}</p>
    </>
  );
  return href ? <a href={href} target="_blank" rel="noreferrer" className="block rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">{content}</a> : <article className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">{content}</article>;
}

export default async function CommunityProductPage({ params }: CommunityPageProps) {
  const { communitySlug } = await params;
  const data = await getCommunityHubData(communitySlug);
  if (!data) notFound();

  const upcomingEvents = data.events.filter((event) => event.status === "upcoming").sort((a, b) => (Date.parse(a.start_at ?? "") || 0) - (Date.parse(b.start_at ?? "") || 0)).slice(0, 6);
  const completedEvents = data.events.filter((event) => event.status === "completed").sort((a, b) => (Date.parse(b.start_at ?? "") || 0) - (Date.parse(a.start_at ?? "") || 0)).slice(0, 6);
  const recentDecisions = data.decisions.slice(0, 8);
  const spendingStories = data.storyRecords.filter((record) => record.storyType === "spending").slice(0, 4);
  const caseStories = data.storyRecords.filter((record) => record.storyType === "case").slice(0, 4);
  const electionStories = data.storyRecords.filter((record) => record.storyType === "election" || record.storyType === "vote").slice(0, 4);
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
          </div>
        </div>
        {data.coverageRow?.missingCategories.length ? (
          <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            Limited data: missing reviewed local {data.coverageRow.missingCategories.join(", ")} coverage. Broader Nevada records may still affect residents here.
          </div>
        ) : null}
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
        <SectionHeading eyebrow="Officials" title="Who is responsible?" description="Named officials appear only when a source-backed roster or official action record exists." />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {data.officials.length ? data.officials.slice(0, 8).map((official) => <OfficialCard key={official.id} official={official} />) : <EmptyCard text="Official roster acquisition is still needed for this community. No fake officials are shown." />}
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
