import Link from "next/link";
import { notFound } from "next/navigation";

import { seedUsers } from "@/lib/auth/mock-users";
import { CommunityEventCard } from "@/components/domain/community-event-card";
import { CommunityHero } from "@/components/domain/community-hero";
import { CommunitySelector } from "@/components/domain/community-selector";
import { ServiceCard } from "@/components/domain/service-card";
import { TopIssueCard } from "@/components/domain/top-issue-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCurrentUser } from "@/lib/server/auth-session";
import {
  getCommunityById,
  getCommunityHierarchy,
  getCommunityPageHref,
  getLocalCommunityForCampus,
} from "@/lib/community/communities";
import { getCommunityEconomics } from "@/lib/community/economics";
import { getDiscoverableEventsForUser } from "@/lib/community/event-discovery";
import { getTopIssuesForUser } from "@/lib/community/issues";
import { getCommunityHero } from "@/lib/community/place-data";
import { getFeedDebatePreviews, type DebateFeedPreview } from "@/lib/debates/store";
import { getCampusElectionVoteState } from "@/lib/elections/campus-voting";
import { getOrganizationTypeLabel } from "@/lib/organizations/presentation";
import { getElectionSummaries } from "@/lib/server/elections-context";
import { getOrganizationPreviewsForCommunity } from "@/lib/organizations/store";
import { getTopServicesForCommunity } from "@/lib/services/store";
import type { CommunitySummary } from "@/types/domain";

type CampusPageProps = {
  params: Promise<{
    campusId: string;
  }>;
};

const CAMPUS_COST_PROFILES: Record<
  string,
  {
    tuition: string;
    housing: string;
    books: string;
    other: string;
  }
> = {
  "unr-campus": {
    tuition: "$9k in-state · $25k out-of-state",
    housing: "$13k room & board",
    books: "$1.3k books & supplies",
    other: "$2.4k transportation and personal costs",
  },
  "unlv-campus": {
    tuition: "$8.7k in-state · $24.1k out-of-state",
    housing: "$14.2k room & board",
    books: "$1.2k books & supplies",
    other: "$2.7k transportation and personal costs",
  },
  "wnc-campus": {
    tuition: "$4.1k tuition and fees",
    housing: "$9.8k off-campus living estimate",
    books: "$1.1k books & supplies",
    other: "$2.1k transportation and personal costs",
  },
};

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getCampusFeedHref(community: CommunitySummary, type: "post" | "debate") {
  const params = new URLSearchParams({
    scope: "local",
    type,
    community: community.jurisdictionMatches.join("|"),
  });

  return `/feed?${params.toString()}`;
}

function renderPreviewDebate(debate: DebateFeedPreview) {
  return (
    <article key={debate.id} className="rounded-3xl bg-slate-50 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 ring-1 ring-slate-200">
          Debate
        </span>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
          {formatDateLabel(debate.createdAt)}
        </span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-ink">{debate.title}</h3>
      <p className="mt-2 text-sm font-medium text-slate-500">{debate.issueText}</p>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{debate.description}</p>
      <div className="mt-4 text-sm text-slate-500">{debate.participantCount} participants</div>
    </article>
  );
}

function renderElectionPreview(
  election: Awaited<ReturnType<typeof getElectionSummaries>>[number],
  totalVotes: number,
) {
  return (
    <article key={election.id} className="rounded-3xl bg-slate-50 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
          {election.authorityLabel ?? "Community vote only"}
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 ring-1 ring-slate-200">
          {election.electionType}
        </span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-ink">{election.title}</h3>
      <p className="mt-2 text-sm text-slate-600">
        {totalVotes} campus vote{totalVotes === 1 ? "" : "s"} · {election.candidates.length} candidates
      </p>
      <div className="mt-4 space-y-3">
        {election.candidates.slice(0, 2).map((campaign) => (
          <div key={campaign.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-ink">{campaign.officeSought}</p>
            <p className="mt-1 text-xs text-slate-500">{campaign.partyText}</p>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Link href={`/elections/${election.id}`} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
          Open campus election
        </Link>
      </div>
    </article>
  );
}

export default async function CampusPage({ params }: CampusPageProps) {
  const { campusId } = await params;
  const campus = getCommunityById(campusId);

  if (!campus || campus.communityType !== "campus") {
    notFound();
  }

  const user = await getCurrentUser();
  const localCommunity = getLocalCommunityForCampus(campusId);
  const hierarchy = getCommunityHierarchy(campusId);
  const campusCosts = CAMPUS_COST_PROFILES[campusId] ?? {
    tuition: "Tuition estimate coming soon",
    housing: "Housing estimate coming soon",
    books: "Books and supplies estimate coming soon",
    other: "Additional student cost estimate coming soon",
  };

  const [
    topIssues,
    events,
    elections,
    organizations,
    publicCitizens,
    previewDebates,
    services,
  ] = await Promise.all([
    getTopIssuesForUser(user, "local", campusId),
    getDiscoverableEventsForUser(user, { communityId: campusId, scope: "local", limit: 3 }),
    getElectionSummaries(),
    Promise.resolve(getOrganizationPreviewsForCommunity(campusId, 4)),
    Promise.resolve(
      seedUsers
        .filter((entry) => !entry.isAnonymousPublic)
        .filter(
          (entry) =>
            entry.studentCampusCommunityId === campusId || entry.jurisdictionName === campus.primaryJurisdictionName,
        )
        .slice(0, 4),
    ),
    getFeedDebatePreviews({ jurisdictionNames: campus.jurisdictionMatches, limit: 3 }),
    Promise.resolve(getTopServicesForCommunity(campusId, 6)),
  ]);

  const localEconomics = localCommunity ? getCommunityEconomics(localCommunity.id).selected : null;
  const campusElections = elections.filter((election) => election.communityId === campusId);
  const voteStates = await Promise.all(
    campusElections.map(async (election) => [election.id, await getCampusElectionVoteState(election.id, user.id)] as const),
  );
  const voteStateById = new Map(voteStates);
  const returnPath = `/campuses/${campusId}`;

  return (
    <div className="space-y-8 py-8">
      <CommunityHero community={getCommunityHero(campusId)} />

      {hierarchy.length ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Community hierarchy</p>
            <div className="flex flex-wrap items-center gap-2">
              {hierarchy.map((entry) => (
                <Link
                  key={entry.id}
                  href={entry.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    entry.active
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-civic-500 hover:text-civic-700"
                  }`}
                >
                  <span className="mr-2 text-[11px] uppercase tracking-[0.16em] opacity-75">{entry.level}</span>
                  {entry.label}
                </Link>
              ))}
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            {campus.name} sits within the {localCommunity?.name ?? "surrounding"} geographic context, so the campus page uses the same place-based structure while keeping student-specific content separate.
          </p>
        </section>
      ) : null}

      <CommunitySelector
        currentCommunity={campus}
        followedCommunities={[]}
        suggestedCommunities={[]}
        followedIds={[]}
        returnPath={returnPath}
      />

      <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
        Campus pages are viewable by everyone. Joining a campus community, using student-specific profile features, and joining campus orgs remain limited to eligible Student-Verified users.
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Campus Snapshot"
            title="Student costs and campus context"
            description="A campus-specific version of the community snapshot, with institution data and student cost context."
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Institution</p>
              <p className="mt-2 text-sm font-semibold text-ink">{campus.institutionType === "public" ? "Public institution" : "Private institution"}</p>
              <p className="mt-2 text-sm text-slate-600">{campus.enrollmentSize?.toLocaleString() ?? "Enrollment"} students</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tuition</p>
              <p className="mt-2 text-sm font-semibold text-ink">{campusCosts.tuition}</p>
              <p className="mt-2 text-sm text-slate-600">Use this as a quick orientation point before deeper campus affordability discussion.</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Housing</p>
              <p className="mt-2 text-sm font-semibold text-ink">{campusCosts.housing}</p>
              <p className="mt-2 text-sm text-slate-600">Housing cost pressure is usually the biggest overlap between campus life and the surrounding city.</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Local cost context</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {localEconomics ? `Cost of living index ${localEconomics.costOfLivingIndex}` : campus.locationLabel ?? "Campus location context"}
              </p>
              <p className="mt-2 text-sm text-slate-600">{localCommunity ? `${localCommunity.name} is the surrounding local context for off-campus cost pressure.` : "Local city context will appear here when available."}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Student Costs"
            title="Campus cost categories"
            description="A campus-appropriate version of the cost pane, focused on the categories students usually feel most directly."
          />
          <div className="mt-5 space-y-3">
            {[
              { label: "Tuition / fees", value: campusCosts.tuition },
              { label: "Housing / room & board", value: campusCosts.housing },
              { label: "Books / supplies", value: campusCosts.books },
              { label: "Other major costs", value: campusCosts.other },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{item.label}</p>
                  <p className="text-xs text-slate-500">Campus-specific preview estimate</p>
                </div>
                <p className="text-sm font-semibold text-civic-700">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <SectionHeading
          eyebrow="Top Issues"
          title="What this campus is focused on"
          description="The most visible campus priorities, student concerns, and institution-linked public issues."
        />
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {topIssues.length ? (
            topIssues.slice(0, 4).map((issue) => <TopIssueCard key={issue.id} issue={issue} returnPath={returnPath} />)
          ) : (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No campus issues are surfaced here yet.</div>
          )}
        </div>
      </section>

      <section className="grid gap-6">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <div className="flex items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Debates"
              title="Campus debate previews"
              description="A condensed campus debate lane that stays lightweight and routes into the feed when you want more."
            />
            <Link href={getCampusFeedHref(campus, "debate")} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
              Open debates in feed
            </Link>
          </div>
          <div className="mt-5 grid gap-4">
            {previewDebates.length ? (
              previewDebates.slice(0, 2).map((debate) => renderPreviewDebate(debate))
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No campus debates are active yet.</div>
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Civic Activity"
            title="Campus events"
            description="The highest-priority campus surface, with attendance and follow-through tied to real-world participation."
          />
          <div className="mt-5 grid gap-4">
            {events.length ? (
              events.map((event) => (
                <CommunityEventCard
                  key={event.id}
                  event={event}
                  attendanceCount={event.attendanceCount}
                  confirmedCount={event.confirmedCount}
                  distanceLabel={event.distanceLabel}
                  momentumLabel={event.momentumLabel}
                  viewerStatus={event.viewerStatus}
                  returnPath={returnPath}
                  showQuickRsvp
                />
              ))
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No campus events are surfaced yet.</div>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Elections"
            title="Campus election previews"
            description="School-related elections stay in their own section instead of being merged into general civic activity."
          />
          <div className="mt-5 space-y-4">
            {campusElections.length ? (
              campusElections.map((election) =>
                renderElectionPreview(election, voteStateById.get(election.id)?.totalVotes ?? 0),
              )
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">
                No campus elections are active here yet. When one is active, this section will surface school-related community voting and candidate previews.
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="flex items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Services"
            title="Campus services"
            description="A campus-specific services layer for registrar, aid, housing, wellness, access, and student support needs."
          />
          <Link href={`/services?communityId=${campusId}`} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
            View all campus services
          </Link>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {services.length ? (
            services.slice(0, 4).map((service) => <ServiceCard key={service.id} service={service} compact />)
          ) : (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No campus services are surfaced here yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="flex items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Campus Orgs"
            title="Member organizations"
            description="Campus orgs keep the same structured governance and endorsement model while fitting into the same page feel as a normal community."
          />
          <Link href={`/organizations?communityId=${campusId}`} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
            View all orgs
          </Link>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {organizations.length ? (
            organizations.slice(0, 4).map((organization) => (
              <article key={organization.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
                    {getOrganizationTypeLabel(organization.organizationType)}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {organization.memberCount} member{organization.memberCount === 1 ? "" : "s"}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-ink">{organization.name}</h3>
                <p className="mt-2 text-sm text-slate-500">{organization.jurisdictionName}</p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{organization.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {organization.issueTags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4">
                  <Link href={`/organizations/${organization.id}`} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
                    View organization
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No campus organizations are surfaced here yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <SectionHeading
          eyebrow="People"
          title="People in this campus community"
          description="Students and other public-facing users connected to this campus, shown with the same place-based card style as other communities."
        />
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {publicCitizens.length ? (
            publicCitizens.map((citizen) => (
              <article key={citizen.id} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-ink">{citizen.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      @{citizen.username} · {citizen.jurisdictionName}
                    </p>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{citizen.bio}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {citizen.role}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                    {citizen.followerCount.toLocaleString()} followers
                  </span>
                  {citizen.studentVerified ? (
                    <span className="rounded-full bg-civic-50 px-3 py-1 text-civic-700">Student Verified</span>
                  ) : null}
                </div>
                <div className="mt-4">
                  <Link href={`/citizens/${citizen.id}`} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
                    Open profile
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No public campus-linked people are surfaced here yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
