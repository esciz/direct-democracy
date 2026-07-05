import Link from "next/link";
import type { ReactNode } from "react";

import { TakeActionVotePane } from "@/components/domain/take-action-vote-pane";
import { PageIntro } from "@/components/ui/page-intro";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  canUserCreateCommunityEvent,
  canUserMessagePublicFigures,
} from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityHierarchy, getDefaultCommunityForUser } from "@/lib/community/communities";
import { getDiscoverableEventsForUser } from "@/lib/community/event-discovery";
import { getEventPhotobook } from "@/lib/community/event-participation";
import { getElectionSummaries } from "@/lib/server/elections-context";
import { getDailyVoteExperience } from "@/lib/feed/quick-votes";
import { slugifyIssueText } from "@/lib/issues/utils";
import { getGuidedMessageRecipients, getMessageComposerIssues } from "@/lib/messages/store";
import { getIssueDirectoryForUser, getIssueSummary } from "@/lib/server/issues";
import type {
  AuthUser,
  BallotInitiativeSummary,
  CommunityEventSummary,
  CommunitySummary,
  ElectionSummary,
  GuidedMessageRecipientSummary,
  PostSummary,
  TopIssueSummary,
} from "@/types/domain";

function formatCountdown(isoDate: string) {
  const ms = Date.parse(isoDate) - Date.now();
  const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "1 day away";
  }

  if (days < 30) {
    return `${days} days away`;
  }

  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} away`;
}

function formatDateLabel(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

function getStateName(community: CommunitySummary) {
  const stateEntry = getCommunityHierarchy(community.id).find((entry) => entry.level === "State");
  return stateEntry?.label ?? "Nevada";
}

function getRelevantJurisdictions(user: AuthUser, community: CommunitySummary) {
  const stateName = getStateName(community);
  const jurisdictions = new Set<string>([
    user.jurisdictionName,
    community.primaryJurisdictionName,
    ...community.jurisdictionMatches,
    stateName,
    "United States",
  ]);

  return jurisdictions;
}

function getElectionCategory(election: ElectionSummary) {
  const office = `${election.officeTitle} ${election.title}`.toLowerCase();

  if (office.includes("school")) {
    return "Schools";
  }

  if (office.includes("judge") || office.includes("justice") || office.includes("court")) {
    return "Judges";
  }

  if (
    office.includes("governor") ||
    office.includes("president") ||
    office.includes("mayor") ||
    office.includes("sheriff") ||
    office.includes("leader")
  ) {
    return "Leaders";
  }

  return "Legislators";
}

type CompactElectionPaneItem = {
  id: string;
  title: string;
  href: string;
  electionDate: string;
  kind: "election" | "ballotQuestion";
};

type CompactElectionPaneCategory = {
  label: string;
  count: number;
  nextElectionDate: string | null;
  itemLabel: string;
  items: CompactElectionPaneItem[];
};

function buildBallotQuestionItem(initiative: BallotInitiativeSummary, election: ElectionSummary): CompactElectionPaneItem {
  return {
    id: initiative.id,
    title: initiative.title,
    href: `/initiatives/${initiative.id}`,
    electionDate: election.electionDate,
    kind: "ballotQuestion",
  };
}

function isElectionRelevant(
  election: ElectionSummary,
  allowedJurisdictions: Set<string>,
  _user: AuthUser,
) {
  if (allowedJurisdictions.has(election.jurisdictionName)) {
    return true;
  }

  return false;
}

function getUpcomingElection(elections: ElectionSummary[]) {
  return elections.find((election) => Date.parse(election.electionDate) >= Date.now()) ?? elections[0] ?? null;
}

function getUpcomingElectionForCategory(elections: ElectionSummary[]) {
  return elections.find((election) => Date.parse(election.electionDate) >= Date.now()) ?? elections[0] ?? null;
}

async function getRecentPhotobooks(events: CommunityEventSummary[]) {
  return Promise.all(
    events.slice(0, 2).map(async (event) => {
      const photobook = await getEventPhotobook(event.id);
      return {
        event,
        cover: photobook[0] ?? null,
      };
    }),
  );
}

function matchesJurisdiction(jurisdictionName: string, allowedJurisdictions: Set<string>) {
  return allowedJurisdictions.has(jurisdictionName) || jurisdictionName === "United States";
}

function paneChrome(children: ReactNode) {
  return <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">{children}</section>;
}

function SectionActions({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex flex-wrap gap-3">{children}</div>;
}

function ActionLink({ href, label, subtle = false }: { href: string; label: string; subtle?: boolean }) {
  return (
    <Link
      href={href}
      className={
        subtle
          ? "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          : "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
      }
    >
      {label}
    </Link>
  );
}

function CompactItem({
  eyebrow,
  title,
  description,
  href,
  meta,
  cta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  meta?: ReactNode;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-3xl border border-slate-200 bg-white p-4 transition hover:border-civic-500 hover:shadow-card"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-civic-700">{eyebrow}</p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-500">{meta}</span>
        <span className="font-semibold text-civic-700">{cta}</span>
      </div>
    </Link>
  );
}

export default async function TakeActionPage() {
  const user = await getCurrentUser();
  const defaultCommunity = getDefaultCommunityForUser(user);
  const allowedJurisdictions = getRelevantJurisdictions(user, defaultCommunity);
  const canCreateEvent = await canUserCreateCommunityEvent(user);
  const canMessageRepresentatives = user.role === "official" || canUserMessagePublicFigures(user);

  const [
    dailyVotes,
    elections,
    issueDirectory,
    events,
    messageRecipients,
    messageIssues,
  ] = await Promise.all([
    getDailyVoteExperience(user, defaultCommunity.id).catch((error: unknown) => {
      console.error("Take Action daily vote pane failed to load.", error);
      return {
        currentQuestion: null,
        progress: { answered: 0, total: 0, current: 0 },
        pulseQuestions: [],
        remainingQuestions: 0,
        dailyQuestions: [],
      };
    }),
    getElectionSummaries(user.id).catch((error: unknown) => {
      console.error("Take Action elections pane failed to load.", error);
      return [];
    }),
    getIssueDirectoryForUser(user, { communityId: defaultCommunity.id }).catch((error: unknown) => {
      console.error("Take Action issues pane failed to load.", error);
      return [];
    }),
    getDiscoverableEventsForUser(user, {
      communityId: defaultCommunity.id,
      scope: "all",
      date: "all",
      distance: "all",
      type: "all",
      sort: "recommended",
      limit: 10,
    }).catch((error: unknown) => {
      console.error("Take Action events pane failed to load.", error);
      return [];
    }),
    getGuidedMessageRecipients(user).catch((error: unknown) => {
      console.error("Take Action representatives pane failed to load.", error);
      return [];
    }),
    getMessageComposerIssues(user).catch((error: unknown) => {
      console.error("Take Action message issues failed to load.", error);
      return [];
    }),
  ]);

  const relevantElections = elections.filter((election) => isElectionRelevant(election, allowedJurisdictions, user));
  const nextElection = getUpcomingElection(relevantElections);
  const electionGroups = new Map<string, ElectionSummary[]>();

  for (const election of relevantElections) {
    const category = getElectionCategory(election);

    electionGroups.set(category, [...(electionGroups.get(category) ?? []), election]);
  }

  const now = Date.now();
  const ballotQuestionItems = relevantElections.flatMap((election) =>
    election.ballotInitiatives.map((initiative) => buildBallotQuestionItem(initiative, election)),
  );
  const electionCategoryOrder = ["Legislators", "Leaders", "Schools", "Judges", "Ballot Questions"] as const;
  const electionPreviewCategories = electionCategoryOrder.reduce<CompactElectionPaneCategory[]>((categories, category) => {
      if (category === "Ballot Questions") {
        const nextBallotQuestion = ballotQuestionItems.find((item) => Date.parse(item.electionDate) >= Date.now()) ?? ballotQuestionItems[0] ?? null;

        if (ballotQuestionItems.length) {
          categories.push({
              label: category,
              count: ballotQuestionItems.length,
              nextElectionDate: nextBallotQuestion?.electionDate ?? null,
              itemLabel: "ballot question",
              items: ballotQuestionItems,
            });
        }

        return categories;
      }

      const items = electionGroups.get(category) ?? [];
      const nextCategoryElection = getUpcomingElectionForCategory(items);

      if (items.length) {
        categories.push({
            label: category,
            count: items.length,
            nextElectionDate: nextCategoryElection?.electionDate ?? null,
            itemLabel: "election",
            items: items.map((election) => ({
              id: election.id,
              title: election.title,
              href: `/elections/${election.id}`,
              electionDate: election.electionDate,
              kind: "election" as const,
            })),
          });
      }

      return categories;
    }, []);
  const upcomingEvents = events.filter((event) => Date.parse(event.startsAt) >= now).slice(0, 3);
  const recentCompletedEvents = events
    .filter((event) => Date.parse(event.startsAt) < now)
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
    .slice(0, 2);
  const recentPhotobooks = await getRecentPhotobooks(recentCompletedEvents);

  const relevantIssues = issueDirectory
    .filter((issue) => matchesJurisdiction(issue.jurisdictionName, allowedJurisdictions) || issue.jurisdictionName === "Across the platform")
    .slice(0, 3);
  const representativePreviews = messageRecipients.filter((recipient) => recipient.role === "official").slice(0, 3);
  const messagingCampaigns = [
    messageIssues[0]
      ? {
          id: `campaign_issue_${messageIssues[0].id}`,
          title: `Support ${messageIssues[0].issueText}`,
          description: "Open a guided message tied to your top current issue.",
          href: "/messages/new",
        }
      : null,
    relevantIssues[0]
      ? {
          id: `campaign_issue_hub_${relevantIssues[0].id}`,
          title: `Coordinate around ${relevantIssues[0].issueText}`,
          description: "Start from the issue hub, then message the right officials from the full outreach flow.",
          href: `/issues/${slugifyIssueText(relevantIssues[0].issueText)}`,
        }
      : null,
  ].filter((entry): entry is { id: string; title: string; description: string; href: string } => Boolean(entry));

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Take Action"
        title="Start with one clear civic step"
        description="This page is the beginner-friendly action layer: what matters near you, what needs attention, and the easiest next move to make right now."
        meta={
          <>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">{defaultCommunity.name}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {user.jurisdictionName}
            </span>
          </>
        }
      />

      {paneChrome(
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div>
              <SectionHeading
                eyebrow="How to use this page"
                title="You do not need to do everything here"
                description="Start with the one action that feels easiest. The deeper outreach, event creation, and full election tools stay available when you want them."
              />
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Quickest start</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">Answer one civic question or open one issue summary.</p>
                </div>
                <div className="rounded-2xl bg-civic-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Next layer</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">Follow a race, message a representative, or open an issue hub.</p>
                </div>
                <div className="rounded-2xl bg-amber-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Go deeper later</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">Use the full election, messaging, event, and issue pages when you want the heavier civic workflow.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Participation ladder</p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink">A simple path into action</h2>
              <div className="mt-4 space-y-2">
                {["Vote on one public decision", "Open one issue hub", "Check the next election", "Message one representative", "Show up to one event"].map((step) => (
                  <div key={step} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>,
      )}

      {paneChrome(
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionHeading
              eyebrow="1. Elections"
              title="Active and upcoming races in my jurisdictions"
              description="Only the race tracks and ballot questions most relevant to your jurisdictions are surfaced here."
            />
            <div className="flex flex-wrap items-start gap-3">
              <div className="rounded-3xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                {nextElection ? (
                  <>
                    <span className="font-semibold text-ink">Next election:</span> {getElectionCategory(nextElection)} ·{" "}
                    {formatCountdown(nextElection.electionDate)}
                  </>
                ) : (
                  "No upcoming elections are queued right now."
                )}
              </div>
              <ActionLink href={nextElection ? `/elections/${nextElection.id}` : "/elections"} label="Endorse Candidate" subtle />
              <ActionLink href="/elections" label="View All" />
              <ActionLink href="/elections?view=all" label="View Outside My Jurisdictions" subtle />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {electionPreviewCategories.map((category) => (
                <details key={category.label} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{category.label}</p>
                      <p className="mt-2 text-sm font-semibold text-ink">
                        {category.count} relevant {category.itemLabel}
                        {category.count === 1 ? "" : "s"}
                      </p>
                      {category.nextElectionDate ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Next up: {formatCountdown(category.nextElectionDate)}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Expand</span>
                  </summary>
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                    {category.items.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDateLabel(item.electionDate)} · {formatCountdown(item.electionDate)}
                          </p>
                        </div>
                        <Link href={item.href} className="text-xs font-semibold text-civic-700 hover:text-civic-800">
                          View
                        </Link>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
          </div>

        </>,
      )}

      {paneChrome(
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionHeading
              eyebrow="2. Vote"
              title="Cast the next meaningful public vote"
              description="Use this pane to vote on representatives, public decisions, cases, and community-elevated questions without leaving the action flow."
            />
            <ActionLink href="/voting" label="View All" subtle />
          </div>

          <div className="mt-6">
            {dailyVotes.currentQuestion ? (
              <TakeActionVotePane question={dailyVotes.currentQuestion} compact returnPath="/take-action" />
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                You’ve worked through the available vote prompts for now. Keep going in the full Vote page.
                <div className="mt-4">
                  <ActionLink href="/voting" label="See all vote objects" />
                </div>
              </div>
            )}
          </div>
        </>,
      )}

      {paneChrome(
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionHeading
              eyebrow="3. Issues"
              title="Issue hubs for structured civic action"
              description="Open an issue to find the support/oppose structure, related votes, debates, cases, petitions, polls, and evidence shaping what happens next."
            />
            <div className="flex flex-wrap gap-3">
              <ActionLink href="/issues" label="View All Issues" />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {relevantIssues.length ? (
              relevantIssues.map((issue: TopIssueSummary) => (
                <CompactItem
                  key={issue.id}
                  eyebrow={issue.jurisdictionName}
                  title={issue.issueText}
                  description={getIssueSummary(issue.issueText)}
                  href={`/issues/${slugifyIssueText(issue.issueText)}`}
                  meta={
                    <>
                      {issue.scope} · {issue.source === "curated" ? "canonical issue hub" : "community issue activity"}
                    </>
                  }
                  cta="Open issue"
                />
              ))
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No issue hubs are surfaced for your jurisdictions right now.
              </div>
            )}
          </div>

          <SectionActions>
            <ActionLink href="/issues" label="Browse issue hubs" />
            {relevantIssues[0] ? (
              <ActionLink href={`/issues/${slugifyIssueText(relevantIssues[0].issueText)}`} label="Open top issue" subtle />
            ) : null}
          </SectionActions>
        </>,
      )}

      {paneChrome(
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionHeading
              eyebrow="4. Message Your Representative"
              title="Reach the right official without opening the full inbox"
              description="This compact pane highlights your relevant officials and current outreach campaigns, while deeper threads stay on the messaging pages."
            />
            <div className="flex flex-wrap gap-3">
              <ActionLink href="/who-represents-me" label="Who Represents Me" subtle />
              <ActionLink href="/support-statements/new" label="Write Statement of Support" subtle />
              <ActionLink href="/messages" label="View All Messages / Campaigns" />
            </div>
          </div>

          <div className="mt-6">
            <details className="rounded-3xl border border-slate-200 bg-white p-4">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-civic-700">Officials and campaigns</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {representativePreviews.length} representative{representativePreviews.length === 1 ? "" : "s"} ready for outreach
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {messagingCampaigns.length} campaign preview{messagingCampaigns.length === 1 ? "" : "s"} tied to your jurisdictions or issues
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Expand</span>
              </summary>

              <div className="mt-4 space-y-6 border-t border-slate-100 pt-4">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Your representatives</p>
                  {representativePreviews.length ? (
                    representativePreviews.map((recipient: GuidedMessageRecipientSummary) => (
                      <div key={recipient.userId} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{recipient.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {recipient.officeTitle} · {recipient.jurisdictionName}
                          </p>
                        </div>
                        <Link
                          href={recipient.deliveryMode === "source_contact" ? `/officials/${recipient.profileId}` : `/messages/new?recipientUserId=${recipient.userId}`}
                          className="text-xs font-semibold text-civic-700 hover:text-civic-800"
                        >
                          {recipient.deliveryMode === "source_contact" ? "Open Profile" : "Write Message"}
                        </Link>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                      No representative previews are available right now.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Messaging campaigns</p>
                  {messagingCampaigns.length ? (
                    messagingCampaigns.map((campaign) => (
                      <CompactItem
                        key={campaign.id}
                        eyebrow="Campaign"
                        title={campaign.title}
                        description={campaign.description}
                        href={campaign.href}
                        cta="Open"
                      />
                    ))
                  ) : (
                    <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                      Messaging campaigns will surface here when issues create a clear outreach path.
                    </div>
                  )}
                </div>

                <SectionActions>
                  {canMessageRepresentatives ? <ActionLink href="/messages/new" label="Write Message" /> : null}
                  <ActionLink href="/messages" label="View All Messages / Campaigns" subtle />
                  <ActionLink href="/support-statements/new" label="Write Statement of Support" subtle />
                </SectionActions>
              </div>
            </details>
          </div>
        </>,
      )}

      {paneChrome(
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionHeading
              eyebrow="5. Show Up"
              title="Events worth showing up for"
              description="A small set of nearby upcoming events, plus recent moments you can revisit through event photobooks."
            />
            <div className="flex flex-wrap gap-3">
              {canCreateEvent ? <ActionLink href="/events/create" label="Create Event" subtle /> : null}
              <ActionLink href="/events" label="View All" />
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Upcoming</p>
              {upcomingEvents.length ? (
                upcomingEvents.map((event) => (
                  <CompactItem
                    key={event.id}
                    eyebrow={event.eventType.replace(/([A-Z])/g, " $1").trim()}
                    title={event.title}
                    description={event.description}
                    href={`/events/${event.id}`}
                    meta={
                      <>
                        {formatDateLabel(event.startsAt)} · {event.locationLabel ?? event.jurisdictionName} · {event.attendanceCount} attending
                      </>
                    }
                    cta="Attend"
                  />
                ))
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No upcoming events are surfaced for your community right now.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent photobooks</p>
              {recentPhotobooks.length ? (
                recentPhotobooks.map(({ event, cover }: { event: CommunityEventSummary; cover: PostSummary | null }) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 transition hover:border-civic-500"
                  >
                    <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-100">
                      {cover?.mediaUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover.mediaUrl} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Event
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{event.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateLabel(event.startsAt)} · View photobook</p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Completed event photobooks will surface here after recent events wrap up.
                </div>
              )}
            </div>
          </div>
        </>,
      )}
    </div>
  );
}
