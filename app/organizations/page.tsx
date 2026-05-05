import Link from "next/link";

import { OrganizationCard } from "@/components/domain/organization-card";
import { CommunitySelector } from "@/components/domain/community-selector";
import { PageIntro } from "@/components/ui/page-intro";
import { PreserveScrollQueryForm } from "@/components/ui/preserve-scroll-query-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { isGuestUser } from "@/lib/auth/session";
import { approveOrganizationCreationRequest } from "@/lib/organizations/actions";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityById, getDefaultCommunityForUser } from "@/lib/community/communities";
import { getAllOrganizations, getOrganizationCreationRequests, getRecommendedOrganizationsForUser } from "@/lib/organizations/store";

type OrganizationsPageProps = {
  searchParams?: Promise<{
    communityId?: string;
    q?: string;
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

export default async function OrganizationsPage({ searchParams }: OrganizationsPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const defaultCommunity = getDefaultCommunityForUser(user);
  const selectedCommunityId = params?.communityId ?? defaultCommunity.id;
  const currentCommunity = getCommunityById(selectedCommunityId) ?? defaultCommunity;
  const query = params?.q?.trim() ?? "";
  const [organizations, recommendations, requests] = await Promise.all([
    getAllOrganizations(user),
    getRecommendedOrganizationsForUser(user, selectedCommunityId),
    getOrganizationCreationRequests(),
  ]);

  const filtered = organizations.filter(
    (organization) =>
      (organization.communityId === selectedCommunityId || organization.campusCommunityId === selectedCommunityId) &&
      matchesQuery(query, organization.name, organization.description, ...organization.issueTags),
  );
  const campusOrgs = filtered.filter((organization) => organization.organizationType === "campus_org");
  const coalitions = filtered.filter((organization) => organization.organizationType === "coalition");
  const guestMode = isGuestUser(user);

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Organizations"
        title="Campus Orgs and Coalitions"
        description="Structured member organizations for campus coordination, endorsements, platform items, announcements, and collective civic action without any donation or PAC layer."
        actions={
          <Link
            href={`/organizations/create?communityId=${selectedCommunityId}`}
            className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Create organization
          </Link>
        }
      />

      {params?.org ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          {params.org === "requested" && "Your coalition request was submitted for admin review."}
        </section>
      ) : null}
      {params?.orgError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {params.orgError === "fields" && "Add a clear name, description, community, and issue tags before creating an organization."}
          {params.orgError === "type" && "Choose either a Campus Org or a Coalition."}
          {params.orgError === "duplicate" && "An organization with that name already exists."}
          {params.orgError === "campus-permissions" && "Only Student-Verified users tied to that campus can create or manage a Campus Org."}
          {params.orgError === "coalition-permissions" && "Only Trusted Citizens can directly create coalitions. Other users can submit a request for admin approval."}
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

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Organization search</p>
            <p className="mt-2 text-sm text-slate-600">Browse organizations by community and issue focus. Recommendations stay tied to your community and declared interests.</p>
          </div>
          <PreserveScrollQueryForm action="/organizations" className="flex flex-wrap gap-3">
            <input type="hidden" name="communityId" value={selectedCommunityId} />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search organizations or issue tags"
              className="min-w-[18rem] rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
            />
            <button type="submit" className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Search
            </button>
          </PreserveScrollQueryForm>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <SectionHeading
          eyebrow="Recommended"
          title="Suggested for you"
          description="Recommendations are based on your community, campus affiliation, top issues, and public interest tags."
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {recommendations.length ? (
            recommendations.map((organization) => <OrganizationCard key={organization.id} organization={organization} compact guestMode={guestMode} />)
          ) : (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No recommendations yet in this community. As more organizations appear, this section will match on campus, issue tags, and interests.</div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Campus Orgs"
            title="Campus organizations"
            description="Student-Verified organizations for clubs, advocacy groups, academic societies, service groups, and student-led coordination."
          />
          <div className="mt-5 grid gap-4">
            {campusOrgs.length ? (
              campusOrgs.map((organization) => <OrganizationCard key={organization.id} organization={organization} guestMode={guestMode} />)
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No campus orgs are surfaced in this community yet.</div>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Coalitions"
            title="Coalitions"
            description="Broader civic organizations for coordinated issue work, endorsements, petitions, debates, and member announcements."
          />
          <div className="mt-5 grid gap-4">
            {coalitions.length ? (
              coalitions.map((organization) => <OrganizationCard key={organization.id} organization={organization} guestMode={guestMode} />)
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No coalitions are surfaced in this community yet.</div>
            )}
          </div>
        </section>
      </section>

      {user.role === "admin" && requests.length ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Admin"
            title="Pending coalition requests"
            description="Citizens can request coalitions. Admin approval promotes the request into a live organization."
          />
          <div className="mt-5 grid gap-4">
            {requests.map((request) => (
              <article key={request.id} className="rounded-3xl bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{request.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{request.requestedByUserName} · {request.issueTags.join(" · ")}</p>
                  </div>
                  <form action={approveOrganizationCreationRequest}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button type="submit" className="rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700">
                      Approve
                    </button>
                  </form>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{request.description}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
