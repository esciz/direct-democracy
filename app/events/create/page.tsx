import Link from "next/link";
import { redirect } from "next/navigation";

import { CommunityEventForm } from "@/components/domain/community-event-form";
import { canUserCreateCommunityEvent, getDirectCreateEventTypesForUser, getProposableEventTypesForUser } from "@/lib/auth/guards";
import { getRoleLabel } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityById, getDefaultCommunityForJurisdiction } from "@/lib/community/communities";
import { getOrganizationById } from "@/lib/organizations/store";
import { getIssuePickerOptions } from "@/lib/server/issues";

type CreateEventPageProps = {
  searchParams?: Promise<{
    communityId?: string;
    error?: string;
    organizationId?: string;
  }>;
};

export default async function CreateEventPage({ searchParams }: CreateEventPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;

  if (!(await canUserCreateCommunityEvent(user))) {
    redirect("/events?denied=create-event");
  }

  const community = getCommunityById(params?.communityId) ?? getDefaultCommunityForJurisdiction(user.jurisdictionName);
  const organization = params?.organizationId ? await getOrganizationById(params.organizationId, user) : null;
  const returnPath = `/events?communityId=${community.id}`;
  const directTypes = getDirectCreateEventTypesForUser(user);
  const proposalTypes = getProposableEventTypesForUser(user);
  const issueOptions = await getIssuePickerOptions(user, community.id);

  return (
    <div className="space-y-6 py-8">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Events</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Create an issue-related event</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Trusted citizens can publish the full event range directly. Citizens can directly create community and cultural events, and can propose higher-trust civic events for community support or trusted approval.
        </p>
        <div className="mt-4">
          <Link href={returnPath} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
            Browse events in {community.name}
          </Link>
        </div>
      </section>

      <CommunityEventForm
        community={community}
        roleLabel={getRoleLabel(user.role)}
        userRole={user.role}
        directTypes={directTypes}
        proposalTypes={proposalTypes}
        error={params?.error}
        returnPath={returnPath}
        organization={organization && organization.canManage ? organization : null}
        issueOptions={issueOptions}
      />
    </div>
  );
}
