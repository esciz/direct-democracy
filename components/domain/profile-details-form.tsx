import { FavoriteSpotsInput } from "@/components/domain/favorite-spots-input";
import { ProfileTagInput } from "@/components/domain/profile-tag-input";
import { StructuredOptionInput } from "@/components/domain/structured-option-input";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { getGeographicCommunities } from "@/lib/community/communities";
import { updateProfileDetails } from "@/lib/profile/actions";
import { EXTERNAL_LINK_FIELDS } from "@/lib/profile/external-links";
import { PREDEFINED_GROUP_TAG_OPTIONS, PREDEFINED_ISSUE_OPTIONS } from "@/lib/profile/options";
import type { AuthUser, UserProfileContentSummary } from "@/types/domain";

const POLITICAL_AFFILIATION_OPTIONS = ["Democrat", "Republican", "Independent", "Other", "Prefer not to say"] as const;

type ProfileDetailsFormProps = {
  user: AuthUser;
  content: UserProfileContentSummary;
};

export function ProfileDetailsForm({ user, content }: ProfileDetailsFormProps) {
  const geographicCommunities = getGeographicCommunities();
  const externalLinkValues = new Map((content.externalLinks ?? []).map((link) => [link.platform, link.url] as const));

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Profile details</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Shape how you appear in your community</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
        Use the same structured pattern everywhere: pick a common option when it fits, or write in your own when it doesn&apos;t.
      </p>

      <form action={updateProfileDetails} className="mt-6 grid gap-6">
        <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-medium text-ink">Communities and onboarding</p>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            Choose your main geographic community so Direct Democracy can focus your city, county, school district, state, and federal civic context.
          </p>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div>
              <label htmlFor="primaryCommunityId" className="text-sm font-medium text-ink">
                Geographic community
              </label>
              <select
                id="primaryCommunityId"
                name="primaryCommunityId"
                defaultValue={content.primaryCommunityId}
                className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              >
                {geographicCommunities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Civic context</p>
              <div className="mt-2 rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                Your selected community anchors local voting cards, public meetings, officials, issues, and service links. Voter verification remains separate from profile setup.
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-medium text-ink">Profile appearance</p>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            Add a profile photo and banner image URL to make your profile feel more personal. Keep images clear, public-safe, and representative.
          </p>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div>
              <label htmlFor="profileImageUrl" className="text-sm font-medium text-ink">
                Profile photo URL
              </label>
              <input
                id="profileImageUrl"
                name="profileImageUrl"
                defaultValue={content.profileImageUrl}
                placeholder="https://example.com/profile-photo.jpg"
                className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
            </div>
            <div>
              <label htmlFor="bannerImageUrl" className="text-sm font-medium text-ink">
                Banner image URL
              </label>
              <input
                id="bannerImageUrl"
                name="bannerImageUrl"
                defaultValue={content.bannerImageUrl}
                placeholder="https://example.com/banner-image.jpg"
                className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-medium text-ink">External Links</p>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            Add optional public links for credibility and discovery. These stay secondary on your profile and do not import outside content into Direct Democracy.
          </p>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {EXTERNAL_LINK_FIELDS.map((field) => (
              <div key={field.platform}>
                <label htmlFor={field.inputName} className="text-sm font-medium text-ink">
                  {field.label}
                </label>
                <input
                  id={field.inputName}
                  name={field.inputName}
                  defaultValue={externalLinkValues.get(field.platform) ?? ""}
                  placeholder={field.placeholder}
                  className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                />
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <StructuredOptionInput
            label="Top 3 local issues"
            inputName="localIssues"
            options={PREDEFINED_ISSUE_OPTIONS.local}
            values={content.localIssues}
            maxItems={3}
            allowCustom={false}
            helpText="Choose from the shared issue taxonomy so your profile links cleanly to issue hubs."
          />
          <StructuredOptionInput
            label="Top 3 state issues"
            inputName="stateIssues"
            options={PREDEFINED_ISSUE_OPTIONS.state}
            values={content.stateIssues}
            maxItems={3}
            allowCustom={false}
            helpText="Choose from the shared issue taxonomy so your profile links cleanly to issue hubs."
          />
          <StructuredOptionInput
            label="Top 3 national issues"
            inputName="nationalIssues"
            options={PREDEFINED_ISSUE_OPTIONS.national}
            values={content.nationalIssues}
            maxItems={3}
            allowCustom={false}
            helpText="Choose from the shared issue taxonomy so your profile links cleanly to issue hubs."
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <FavoriteSpotsInput inputName="favoriteSpots" spots={content.favoriteSpots} />
          <StructuredOptionInput
            label="Group tags"
            inputName="groupTags"
            options={PREDEFINED_GROUP_TAG_OPTIONS}
            values={content.groupTags}
            maxItems={6}
            customLabel="Other / Custom"
          />
        </div>

        <section className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-medium text-ink">Background</p>
            <p className="mt-1 text-xs leading-6 text-slate-500">Self-reported only. This is optional and is not verified or used as proof of authority.</p>
            <div className="mt-4 grid gap-4">
              <div>
                <label htmlFor="profession" className="text-sm font-medium text-ink">
                  Profession
                </label>
                <input
                  id="profession"
                  name="profession"
                  defaultValue={content.background.profession}
                  placeholder="e.g. Teacher, business owner"
                  className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                />
                <label className="mt-3 flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="professionPublic"
                    defaultChecked={content.background.professionPublic}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Show profession publicly
                </label>
              </div>
              <div>
                <label htmlFor="experience" className="text-sm font-medium text-ink">
                  Experience
                </label>
                <textarea
                  id="experience"
                  name="experience"
                  rows={4}
                  defaultValue={content.background.experience}
                  placeholder="Share a short self-reported background note or lived experience if you want."
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                />
                <label className="mt-3 flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="experiencePublic"
                    defaultChecked={content.background.experiencePublic}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Show experience publicly
                </label>
              </div>
              <div>
                <label htmlFor="politicalAffiliation" className="text-sm font-medium text-ink">
                  Political affiliation
                </label>
                <select
                  id="politicalAffiliation"
                  name="politicalAffiliation"
                  defaultValue={content.background.politicalAffiliation}
                  className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                >
                  <option value="">Prefer not to include</option>
                  {POLITICAL_AFFILIATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <label className="mt-3 flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="politicalAffiliationPublic"
                    defaultChecked={content.background.politicalAffiliationPublic}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Show political affiliation publicly
                </label>
              </div>
            </div>
          </div>

          <ProfileTagInput inputName="identityTags" tags={content.identityTags} />
        </section>

        <label className="flex items-center gap-3 rounded-3xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
          <input type="checkbox" name="recentVotesPublic" defaultChecked={content.recentVotesPublic} className="h-4 w-4 rounded border-slate-300" />
          Show recent votes publicly on your citizen profile
        </label>

        <FormSubmitButton
          idleLabel="Save profile details"
          pendingLabel="Saving..."
          className="w-fit rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        />
      </form>
    </section>
  );
}
