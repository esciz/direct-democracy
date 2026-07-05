import Link from "next/link";

import { OrganizationCard } from "@/components/domain/organization-card";
import { CommunitySelector } from "@/components/domain/community-selector";
import { PageIntro } from "@/components/ui/page-intro";
import { PreserveScrollQueryForm } from "@/components/ui/preserve-scroll-query-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { isGuestUser } from "@/lib/auth/session";
import { getCommunityById, getDefaultCommunityForUser } from "@/lib/community/communities";
import { ORGANIZATION_FILTERS, getOrganizationTypeLabel } from "@/lib/organizations/presentation";
import { approveOrganizationCreationRequest } from "@/lib/organizations/actions";
import { getCurrentUser } from "@/lib/server/auth-session";
import {
  getAllOrganizations,
  getGovernmentBodiesForCommunity,
  getOrganizationCreationRequests,
  getRecommendedOrganizationsForUser,
} from "@/lib/organizations/store";
import type { GovernmentBodyDetail } from "@/lib/organizations/store";
import type { OrganizationSummary, OrganizationType } from "@/types/domain";

type OrganizationsPageProps = {
  searchParams?: Promise<{
    communityId?: string;
    q?: string;
    type?: string;
    org?: string;
    orgError?: string;
  }>;
};

function matchesQuery(query: string, ...values: Array<string | null | undefined>) {
  if (!query) {
    return true;
  }

  const normalized = query.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

function normalizeOrganizationFilter(value: string | undefined): "all" | OrganizationType {
  return ORGANIZATION_FILTERS.some((entry) => entry.key === value) ? (value as "all" | OrganizationType) : "all";
}

function filterOrganizations(
  organizations: OrganizationSummary[],
  selectedCommunityId: string,
  query: string,
  selectedType: "all" | OrganizationType,
) {
  return organizations.filter((organization) => {
    const matchesCommunity = organization.communityId === selectedCommunityId;
    const matchesType = selectedType === "all" ? true : organization.organizationType === selectedType;

    return (
      matchesCommunity &&
      matchesType &&
      matchesQuery(query, organization.name, organization.description, organization.jurisdictionName, ...organization.issueTags)
    );
  });
}

function sortBySignal(
  organizations: OrganizationSummary[],
  key: "activeVoteCount" | "activeDebateCount" | "endorsementCount" | "upcomingEventCount" | "statementCount" | "petitionCount",
) {
  return [...organizations].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0) || b.memberCount - a.memberCount);
}

function GovernmentBodyCard({ body }: { body: GovernmentBodyDetail }) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(165deg,rgba(12,22,39,0.96),rgba(8,15,28,0.96))] p-5 shadow-[0_24px_50px_-34px_rgba(2,8,23,0.92)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-cyan-500/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
              Government body
            </span>
            <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-200">
              Source-backed
            </span>
            <span className="rounded-full bg-white/6 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
              {body.level}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-50">
            <Link href={`/organizations/${body.id}`} className="transition hover:text-cyan-100">
              {body.name}
            </Link>
          </h3>
          <p className="mt-2 text-sm text-slate-400">{body.jurisdictionName}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{body.description}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Community</p>
          <p className="mt-2 truncate text-sm font-semibold text-white">{body.communityName ?? "Statewide"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Source type</p>
          <p className="mt-2 truncate text-sm font-semibold text-white">{body.scraperType ?? "manual"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Status</p>
          <p className="mt-2 truncate text-sm font-semibold text-white">{body.active ? "Active" : "Review"}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href={`/organizations/${body.id}`} className="font-semibold text-cyan-100 hover:text-white">
          View body
        </Link>
        {body.sourceUrl ? (
          <Link href={body.sourceUrl} className="font-semibold text-slate-300 hover:text-white">
            Source
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export default async function OrganizationsPage({ searchParams }: OrganizationsPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const defaultCommunity = getDefaultCommunityForUser(user);
  const selectedCommunityId = params?.communityId ?? defaultCommunity.id;
  const currentCommunity = getCommunityById(selectedCommunityId) ?? defaultCommunity;
  const query = params?.q?.trim() ?? "";
  const selectedType = normalizeOrganizationFilter(params?.type);
  const guestMode = isGuestUser(user);

  const [organizations, recommendations, requests, governmentBodies] = await Promise.all([
    getAllOrganizations(user),
    getRecommendedOrganizationsForUser(user, selectedCommunityId),
    getOrganizationCreationRequests(),
    getGovernmentBodiesForCommunity(selectedCommunityId, query),
  ]);

  const filtered = filterOrganizations(organizations, selectedCommunityId, query, selectedType);
  const visibleGovernmentBodies = selectedType === "all" ? governmentBodies.slice(0, 8) : [];
  const featured = [...filtered].sort((a, b) => (b.memberCount + (b.activeVoteCount ?? 0) + (b.endorsementCount ?? 0)) - (a.memberCount + (a.activeVoteCount ?? 0) + (a.endorsementCount ?? 0))).slice(0, 6);
  const recommended = recommendations.filter((organization) => selectedType === "all" || organization.organizationType === selectedType).slice(0, 4);
  const activeVotes = sortBySignal(filtered, "activeVoteCount").filter((organization) => (organization.activeVoteCount ?? 0) > 0).slice(0, 3);
  const activeDebates = sortBySignal(filtered, "activeDebateCount").filter((organization) => (organization.activeDebateCount ?? 0) > 0).slice(0, 3);
  const endorsements = sortBySignal(filtered, "endorsementCount").filter((organization) => organization.endorsementCount > 0).slice(0, 3);
  const petitions = sortBySignal(filtered, "petitionCount").filter((organization) => (organization.petitionCount ?? 0) > 0).slice(0, 3);
  const upcomingEvents = sortBySignal(filtered, "upcomingEventCount").filter((organization) => (organization.upcomingEventCount ?? 0) > 0).slice(0, 3);
  const statements = sortBySignal(filtered, "statementCount").filter((organization) => (organization.statementCount ?? 0) > 0).slice(0, 3);

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Organizations"
        title="Organizations"
        description="Create or join organized civic groups that debate, vote, endorse, and coordinate action."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/organizations?communityId=${selectedCommunityId}`}
              className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/25 hover:text-white"
            >
              Explore organizations
            </Link>
            <Link
              href={`/organizations/create?communityId=${selectedCommunityId}`}
              className="inline-flex rounded-full bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Start an organization
            </Link>
          </div>
        }
      />

      <section className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(160deg,rgba(11,19,33,0.98),rgba(7,13,24,0.96))] p-6 shadow-[0_28px_65px_-34px_rgba(8,15,28,0.95)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">How organizations work</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Structured civic groups, not individual profiles</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Organizations include citizen-created civic groups and source-backed government bodies. Member workflows apply to civic groups; public bodies are shown for source transparency and meeting navigation.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Groups live</p>
              <p className="mt-2 text-2xl font-semibold text-white">{filtered.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Active votes</p>
              <p className="mt-2 text-2xl font-semibold text-white">{filtered.reduce((sum, organization) => sum + (organization.activeVoteCount ?? 0), 0)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Debates live</p>
              <p className="mt-2 text-2xl font-semibold text-white">{filtered.reduce((sum, organization) => sum + (organization.activeDebateCount ?? 0), 0)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Public bodies</p>
              <p className="mt-2 text-2xl font-semibold text-white">{governmentBodies.length}</p>
            </div>
          </div>
        </div>
      </section>

      {params?.org ? (
        <section className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-500/10 p-5 text-sm text-cyan-100 shadow-card">
          {params.org === "requested" && "Your organization request was submitted for admin review."}
        </section>
      ) : null}
      {params?.orgError ? (
        <section className="rounded-[1.75rem] border border-orange-300/20 bg-orange-500/10 p-5 text-sm text-orange-100 shadow-card">
          {params.orgError === "fields" && "Add a clear name, description, community, and issue tags before creating an organization."}
          {params.orgError === "type" && "Choose a valid organization type to continue."}
          {params.orgError === "duplicate" && "An organization with that name already exists."}
          {params.orgError === "coalition-permissions" && "Only Trusted Citizens can directly create broader civic organizations. Other users can submit a request for admin approval."}
        </section>
      ) : null}

      <CommunitySelector
        currentCommunity={currentCommunity}
        followedCommunities={[]}
        suggestedCommunities={[]}
        followedIds={[]}
        returnPath="/organizations"
        destinationBase="/organizations"
      />

      <section className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(160deg,rgba(11,19,33,0.98),rgba(7,13,24,0.96))] p-6 shadow-[0_24px_55px_-32px_rgba(8,15,28,0.92)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/80">Filters</p>
            <p className="mt-2 text-sm text-slate-400">Browse civic groups and source-backed public bodies. Type filters apply to member organizations only.</p>
          </div>
          <PreserveScrollQueryForm action="/organizations" className="flex flex-wrap gap-3">
            <input type="hidden" name="communityId" value={selectedCommunityId} />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search organizations, issues, or jurisdictions"
              className="min-w-[16rem] rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/25"
            />
            <button type="submit" className="rounded-full bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
              Search
            </button>
          </PreserveScrollQueryForm>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {ORGANIZATION_FILTERS.map((filter) => {
            const href = new URLSearchParams({ communityId: selectedCommunityId });
            if (query) href.set("q", query);
            if (filter.key !== "all") href.set("type", filter.key);

            const active = filter.key === selectedType;
            return (
              <Link
                key={filter.key}
                href={`/organizations?${href.toString()}`}
                className={
                  active
                    ? "rounded-full border border-cyan-300/30 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100"
                    : "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/20 hover:text-white"
                }
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(160deg,rgba(11,19,33,0.98),rgba(7,13,24,0.96))] p-6 shadow-[0_24px_55px_-32px_rgba(8,15,28,0.92)]">
        <SectionHeading
          eyebrow="Government bodies"
          title="Source-backed public bodies"
          description="Public bodies come from the generated Nevada meeting-source layer. They link to internal body pages first, with original source links kept visible."
        />
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {visibleGovernmentBodies.length ? (
            visibleGovernmentBodies.map((body) => <GovernmentBodyCard key={body.id} body={body} />)
          ) : selectedType === "all" ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400 xl:col-span-2">
              No source-backed public bodies match this community view yet.
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400 xl:col-span-2">
              Public bodies are shown when the organization type filter is set to All.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(160deg,rgba(11,19,33,0.98),rgba(7,13,24,0.96))] p-6 shadow-[0_24px_55px_-32px_rgba(8,15,28,0.92)]">
        <SectionHeading
          eyebrow="Featured"
          title="Featured organizations"
          description="Structured civic groups coordinating members, endorsements, debate, petitions, events, and public positions."
        />
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {featured.length ? (
            featured.map((organization) => <OrganizationCard key={organization.id} organization={organization} guestMode={guestMode} />)
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400 xl:col-span-2">
              No organizations match this preview yet.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(160deg,rgba(11,19,33,0.98),rgba(7,13,24,0.96))] p-6 shadow-[0_24px_55px_-32px_rgba(8,15,28,0.92)]">
          <SectionHeading
            eyebrow="Activity"
            title="Organization activity"
            description="A quick read on the organizations actively voting, debating, endorsing, petitioning, and publishing public positions."
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              { title: "Active organization votes", items: activeVotes, keyLabel: "votes", getValue: (organization: OrganizationSummary) => organization.activeVoteCount ?? 0 },
              { title: "Active debates", items: activeDebates, keyLabel: "debates", getValue: (organization: OrganizationSummary) => organization.activeDebateCount ?? 0 },
              { title: "Recent endorsements", items: endorsements, keyLabel: "endorsements", getValue: (organization: OrganizationSummary) => organization.endorsementCount },
              { title: "Member petitions", items: petitions, keyLabel: "petitions", getValue: (organization: OrganizationSummary) => organization.petitionCount ?? 0 },
              { title: "Upcoming events", items: upcomingEvents, keyLabel: "events", getValue: (organization: OrganizationSummary) => organization.upcomingEventCount ?? 0 },
              { title: "Statements / public positions", items: statements, keyLabel: "statements", getValue: (organization: OrganizationSummary) => organization.statementCount ?? 0 },
            ].map((section) => (
              <div key={section.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold text-white">{section.title}</p>
                <div className="mt-4 space-y-3">
                  {section.items.length ? (
                    section.items.map((organization) => (
                      <Link key={`${section.title}-${organization.id}`} href={`/organizations/${organization.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 transition hover:border-cyan-300/20 hover:bg-white/[0.05]">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-100">{organization.name}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{getOrganizationTypeLabel(organization.organizationType)} · {organization.jurisdictionName}</p>
                        </div>
                        <span className="rounded-full bg-cyan-500/12 px-2.5 py-1 text-xs font-semibold text-cyan-100">{section.getValue(organization)} {section.keyLabel}</span>
                      </Link>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No {section.title.toLowerCase()} surfaced in this community view yet.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <section className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(160deg,rgba(11,19,33,0.98),rgba(7,13,24,0.96))] p-6 shadow-[0_24px_55px_-32px_rgba(8,15,28,0.92)]">
            <SectionHeading
              eyebrow="Preview"
              title="What an organization page includes"
              description="A reusable structure for broader civic group profiles."
            />
            <div className="mt-5 grid gap-2 text-sm text-slate-300">
              {["About", "Members", "Votes", "Debates", "Endorsements", "Events", "Public statements", "Transparency / funding"].map((label) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  {label}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(160deg,rgba(11,19,33,0.98),rgba(7,13,24,0.96))] p-6 shadow-[0_24px_55px_-32px_rgba(8,15,28,0.92)]">
            <SectionHeading
              eyebrow="Suggested"
              title="Recommended for you"
              description="Based on your community, issue interests, and existing civic activity."
            />
            <div className="mt-5 grid gap-3">
              {recommended.length ? (
                recommended.map((organization) => <OrganizationCard key={organization.id} organization={organization} compact guestMode={guestMode} />)
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400">
                  No recommendations yet in this community. As more organizations appear, this section will match on issue tags, location, and participation patterns.
                </div>
              )}
            </div>
          </section>
        </section>
      </section>

      {user.role === "admin" && requests.length ? (
        <section className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(160deg,rgba(11,19,33,0.98),rgba(7,13,24,0.96))] p-6 shadow-[0_24px_55px_-32px_rgba(8,15,28,0.92)]">
          <SectionHeading
            eyebrow="Admin"
            title="Pending organization requests"
            description="Citizens can request broader civic organizations. Admin approval promotes the request into a live organization."
          />
          <div className="mt-5 grid gap-4">
            {requests.map((request) => (
              <article key={request.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{request.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{request.requestedByUserName} · {request.issueTags.join(" · ")}</p>
                  </div>
                  <form action={approveOrganizationCreationRequest}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button type="submit" className="rounded-full bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
                      Approve
                    </button>
                  </form>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{request.description}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
