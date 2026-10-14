import { redirect } from "next/navigation";

import { IssuePickerField } from "@/components/domain/issue-picker-field";
import { PageIntro } from "@/components/ui/page-intro";
import { createOrganization } from "@/lib/organizations/actions";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityById, getGeographicCommunities, getDefaultCommunityForUser } from "@/lib/community/communities";
import { canUserDirectlyCreateCoalition, canUserRequestCoalition } from "@/lib/organizations/store";
import { getIssuePickerOptions } from "@/lib/server/issues";

type CreateOrganizationPageProps = {
  searchParams?: Promise<{
    communityId?: string;
  }>;
};

export default async function CreateOrganizationPage({ searchParams }: CreateOrganizationPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const selectedCommunity = getCommunityById(params?.communityId) ?? getDefaultCommunityForUser(user);
  const geographicCommunities = getGeographicCommunities();
  const issueOptions = await getIssuePickerOptions(user);

  if (!canUserDirectlyCreateCoalition(user) && !canUserRequestCoalition(user)) {
    redirect("/organizations");
  }

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Create Organization"
        title="Start an organization"
        description="Create a civic coalition for advocacy groups, neighborhood groups, labor-style efforts, nonprofit-style work, and other organized member action."
      />

      <section className="grid gap-6">
        <form action={createOrganization} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
          <input type="hidden" name="organizationType" value="coalition" />
          <input type="hidden" name="returnPath" value="/organizations" />
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Coalition</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
            {canUserDirectlyCreateCoalition(user) ? "Launch a coalition" : "Request a coalition"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Trusted Citizens can create coalitions directly. Other users can submit a coalition request for admin approval.
          </p>
          <div className="mt-5 grid gap-4">
            <div>
              <label htmlFor="coalition-name" className="text-sm font-semibold text-ink">Coalition name</label>
              <input id="coalition-name" name="name" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" placeholder="Example: Carson City neighborhood housing group" />
            </div>
            <div>
              <label htmlFor="coalition-description" className="text-sm font-semibold text-ink">Description</label>
              <textarea id="coalition-description" name="description" rows={5} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" placeholder="Describe the coalition's purpose, membership, and main issue focus." />
            </div>
            <div>
              <label htmlFor="coalition-community" className="text-sm font-semibold text-ink">Community</label>
              <select id="coalition-community" name="communityId" defaultValue={selectedCommunity.id} className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500">
                {geographicCommunities.map((community) => (
                  <option key={community.id} value={community.id}>{community.name}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Issue tags</p>
              <div className="mt-2 grid gap-3">
                <IssuePickerField name="coalitionIssueTagPrimary" label="Primary issue" options={issueOptions} placeholder="Select a shared issue" allowCustom={false} required />
                <IssuePickerField name="coalitionIssueTagSecondary" label="Secondary issue" options={issueOptions} placeholder="Optional second issue" allowCustom={false} />
                <IssuePickerField name="coalitionIssueTagTertiary" label="Tertiary issue" options={issueOptions} placeholder="Optional third issue" allowCustom={false} />
              </div>
            </div>
          </div>
          <button type="submit" className="mt-5 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            {canUserDirectlyCreateCoalition(user) ? "Create Coalition" : "Request Coalition"}
          </button>
        </form>
      </section>
    </div>
  );
}
