import { redirect } from "next/navigation";

import { IssuePickerField } from "@/components/domain/issue-picker-field";
import { PageIntro } from "@/components/ui/page-intro";
import { createOrganization } from "@/lib/organizations/actions";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCampusCommunities, getCommunityById, getGeographicCommunities, getDefaultCommunityForUser } from "@/lib/community/communities";
import { canUserCreateCampusOrg, canUserDirectlyCreateCoalition, canUserRequestCoalition } from "@/lib/organizations/store";
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
  const campusCommunities = getCampusCommunities().filter((community) => canUserCreateCampusOrg(user, community.id));
  const geographicCommunities = getGeographicCommunities();
  const issueOptions = await getIssuePickerOptions(user);

  if (!campusCommunities.length && !canUserDirectlyCreateCoalition(user) && !canUserRequestCoalition(user)) {
    redirect("/organizations");
  }

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Create Organization"
        title="Start a Campus Org or Coalition"
        description="Campus Orgs are student-led and campus-tied. Coalitions are broader civic organizations with member approval, platform items, endorsements, and announcements."
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <form action={createOrganization} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
          <input type="hidden" name="organizationType" value="campus_org" />
          <input type="hidden" name="returnPath" value="/organizations" />
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Campus Org</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Student-led organization</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Only Student-Verified users tied to a campus can create and manage Campus Orgs.
          </p>
          <div className="mt-5 grid gap-4">
            <div>
              <label htmlFor="campus-name" className="text-sm font-semibold text-ink">Organization name</label>
              <input id="campus-name" name="name" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" placeholder="UNR Student Transit Alliance" />
            </div>
            <div>
              <label htmlFor="campus-description" className="text-sm font-semibold text-ink">Description</label>
              <textarea id="campus-description" name="description" rows={5} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" placeholder="Explain what the org does, who it serves, and what civic or campus role it plays." />
            </div>
            <div>
              <label htmlFor="campus-community" className="text-sm font-semibold text-ink">Campus community</label>
              <select id="campus-community" name="communityId" defaultValue={selectedCommunity.communityType === "campus" ? selectedCommunity.id : campusCommunities[0]?.id ?? ""} className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500">
                {campusCommunities.length ? (
                  campusCommunities.map((community) => (
                    <option key={community.id} value={community.id}>{community.name}</option>
                  ))
                ) : (
                  <option value="">Student verification required</option>
                )}
              </select>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Issue tags</p>
              <div className="mt-2 grid gap-3">
                <IssuePickerField name="campusIssueTagPrimary" label="Primary issue" options={issueOptions} placeholder="Select a shared issue" allowCustom={false} required />
                <IssuePickerField name="campusIssueTagSecondary" label="Secondary issue" options={issueOptions} placeholder="Optional second issue" allowCustom={false} />
                <IssuePickerField name="campusIssueTagTertiary" label="Tertiary issue" options={issueOptions} placeholder="Optional third issue" allowCustom={false} />
              </div>
            </div>
          </div>
          <button type="submit" disabled={!campusCommunities.length} className="mt-5 rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300">
            Create Campus Org
          </button>
        </form>

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
              <input id="coalition-name" name="name" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" placeholder="Nevada Housing Action Coalition" />
            </div>
            <div>
              <label htmlFor="coalition-description" className="text-sm font-semibold text-ink">Description</label>
              <textarea id="coalition-description" name="description" rows={5} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" placeholder="Describe the coalition's purpose, membership, and main issue focus." />
            </div>
            <div>
              <label htmlFor="coalition-community" className="text-sm font-semibold text-ink">Community</label>
              <select id="coalition-community" name="communityId" defaultValue={selectedCommunity.communityType === "geographic" ? selectedCommunity.id : "nevada"} className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500">
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
