import { FavoriteSpotsInput } from "@/components/domain/favorite-spots-input";
import { ProfileMediaFields } from "@/components/domain/profile-media-fields";
import { ProfileTagInput } from "@/components/domain/profile-tag-input";
import { StructuredOptionInput } from "@/components/domain/structured-option-input";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import {
  Check,
  Link as LinkIcon,
  MapPin,
  Palette,
  Target,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
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

function SectionHeading({
  id,
  icon: Icon,
  iconClassName,
  eyebrow,
  title,
  detail,
}: {
  id: string;
  icon: LucideIcon;
  iconClassName: string;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${iconClassName}`} aria-hidden="true">
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{eyebrow}</p>
        <h3 id={id} className="mt-1.5 text-lg font-semibold text-slate-100">
          {title}
        </h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function VisibilityToggle({ name, defaultChecked }: { name: string; defaultChecked: boolean }) {
  return (
    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-white/20 hover:text-slate-200">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative h-4 w-7 rounded-full bg-slate-700 transition peer-checked:bg-cyan-500" aria-hidden="true">
        <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition peer-checked:translate-x-3" />
      </span>
      Public
    </label>
  );
}

export function ProfileDetailsForm({ user, content }: ProfileDetailsFormProps) {
  const geographicCommunities = getGeographicCommunities();
  const externalLinkValues = new Map((content.externalLinks ?? []).map((link) => [link.platform, link.url] as const));
  const externalLinkCount = content.externalLinks?.length ?? 0;
  const isBright = content.profileTheme === "bright";
  const fieldClass = isBright
    ? "mt-2 min-h-11 w-full rounded-lg border border-white/12 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-[#ff8a70] focus:ring-2 focus:ring-[#ff8a70]/15"
    : "mt-2 min-h-11 w-full rounded-lg border border-white/12 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10";
  const checkboxClass = `h-4 w-4 rounded border-white/20 bg-slate-950 ${isBright ? "text-[#ff8a70]" : "text-cyan-400"}`;
  const classicIcon = "border-cyan-300/20 bg-cyan-300/10 text-cyan-200";

  return (
    <section>
      <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${isBright ? "text-[#b9f66b]" : "text-emerald-200"}`}>Edit profile</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">The details neighbors see</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Start with a photo, community, and priorities. Everything else is optional.
      </p>

      <form action={updateProfileDetails} className="mt-7 grid gap-8">
        <div className="sticky top-3 z-20 -mx-2 flex flex-col gap-3 rounded-xl border border-emerald-300/30 bg-slate-950/95 p-3 shadow-[0_20px_55px_-20px_rgba(16,185,129,0.7)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="px-1">
            <p className="text-sm font-semibold text-slate-100">Save your profile</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-400">Photo previews and card edits are not applied until you save.</p>
          </div>
          <FormSubmitButton
            idleLabel={
              <span className="inline-flex items-center gap-2">
                <Check size={17} strokeWidth={2} aria-hidden="true" />
                Save all changes
              </span>
            }
            pendingLabel="Saving changes..."
            className={`min-h-12 w-full shrink-0 rounded-lg px-6 py-3 text-sm font-bold text-slate-950 shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:w-auto ${
              isBright ? "bg-[#ff8a70] hover:bg-[#ff9c86]" : "bg-emerald-300 hover:bg-emerald-200"
            }`}
          />
        </div>

        <section aria-labelledby="profile-home-heading" className="border-b border-white/10 pb-8">
          <SectionHeading
            id="profile-home-heading"
            icon={MapPin}
            iconClassName={isBright ? "border-[#ff8a70]/30 bg-[#ff8a70]/12 text-[#ffb29f]" : classicIcon}
            eyebrow="Home"
            title="Your primary community"
            detail="This controls the local voting cards, meetings, officials, and issues shown to you."
          />
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.7fr)]">
            <div>
              <label htmlFor="primaryCommunityId" className="text-sm font-semibold text-slate-200">
                Community
              </label>
              <select
                id="primaryCommunityId"
                name="primaryCommunityId"
                defaultValue={content.primaryCommunityId}
                className={fieldClass}
              >
                {geographicCommunities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="border-l-2 border-emerald-300/30 pl-4 text-sm leading-6 text-slate-400">
              Your residence and voter verification remain separate. Changing this preference does not change your verified voting jurisdiction.
            </p>
          </div>
        </section>

        <fieldset className="border-b border-white/10 pb-8">
          <legend className="sr-only">Profile color</legend>
          <SectionHeading
            id="profile-color-heading"
            icon={Palette}
            iconClassName={isBright ? "border-[#ffd166]/30 bg-[#ffd166]/12 text-[#ffe29a]" : classicIcon}
            eyebrow="Color"
            title="Choose your profile mood"
            detail="Keep the civic palette restrained or add brighter accents to your profile."
          />
          <div className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-2" aria-labelledby="profile-color-heading">
            <label className="cursor-pointer">
              <input
                type="radio"
                name="profileTheme"
                value="classic"
                defaultChecked={!isBright}
                className="peer sr-only"
              />
              <span className="flex min-h-20 items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 transition peer-checked:border-cyan-300/60 peer-checked:bg-cyan-300/[0.07]">
                <span>
                  <span className="block text-sm font-semibold text-slate-100">Classic civic</span>
                  <span className="mt-1 block text-xs text-slate-400">Calm and focused</span>
                </span>
                <span className="grid grid-cols-2 gap-1" aria-hidden="true">
                  <span className="h-5 w-5 rounded bg-[#07111f]" />
                  <span className="h-5 w-5 rounded bg-cyan-300" />
                  <span className="h-5 w-5 rounded bg-emerald-300" />
                  <span className="h-5 w-5 rounded bg-amber-200" />
                </span>
              </span>
            </label>
            <label className="cursor-pointer">
              <input
                type="radio"
                name="profileTheme"
                value="bright"
                defaultChecked={isBright}
                className="peer sr-only"
              />
              <span className="flex min-h-20 items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 transition peer-checked:border-[#ff8a70] peer-checked:bg-[#ff8a70]/[0.08]">
                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                    Bright civic
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">Warm and energetic</span>
                </span>
                <span className="grid grid-cols-2 gap-1" aria-hidden="true">
                  <span className="h-5 w-5 rounded bg-[#ff8a70]" />
                  <span className="h-5 w-5 rounded bg-[#54d6d0]" />
                  <span className="h-5 w-5 rounded bg-[#b9f66b]" />
                  <span className="h-5 w-5 rounded bg-[#ffd166]" />
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <ProfileMediaFields
          userName={user.name}
          profileImageUrl={content.profileImageUrl}
          bannerImageUrl={content.bannerImageUrl}
          isBright={isBright}
        />

        <section aria-labelledby="profile-priorities-heading" className="border-b border-white/10 pb-8">
          <SectionHeading
            id="profile-priorities-heading"
            icon={Target}
            iconClassName={isBright ? "border-[#b9f66b]/30 bg-[#b9f66b]/10 text-[#d8ffa8]" : classicIcon}
            eyebrow="Priorities"
            title="What matters most to you"
            detail="Rank up to three topics at each level. These connect your profile to the same issue pages used across the site."
          />
          <div className="mt-5 grid gap-x-6 gap-y-8 xl:grid-cols-3">
            <StructuredOptionInput
              label="Local"
              inputName="localIssues"
              options={PREDEFINED_ISSUE_OPTIONS.local}
              values={content.localIssues}
              maxItems={3}
              allowCustom={false}
              helpText="City, county, and nearby concerns."
            />
            <StructuredOptionInput
              label="Nevada"
              inputName="stateIssues"
              options={PREDEFINED_ISSUE_OPTIONS.state}
              values={content.stateIssues}
              maxItems={3}
              allowCustom={false}
              helpText="Statewide policy and services."
            />
            <StructuredOptionInput
              label="National"
              inputName="nationalIssues"
              options={PREDEFINED_ISSUE_OPTIONS.national}
              values={content.nationalIssues}
              maxItems={3}
              allowCustom={false}
              helpText="Federal issues and national priorities."
            />
          </div>
        </section>

        <section aria-labelledby="profile-community-heading" className="border-b border-white/10 pb-8">
          <SectionHeading
            id="profile-community-heading"
            icon={Users}
            iconClassName={isBright ? "border-[#54d6d0]/30 bg-[#54d6d0]/10 text-[#8ceae6]" : classicIcon}
            eyebrow="Community"
            title="Places and groups you know"
            detail="Optional context for finding useful local voices and recommendations."
          />
          <div className="mt-5 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
            <FavoriteSpotsInput inputName="favoriteSpots" spots={content.favoriteSpots} />
            <StructuredOptionInput
              label="Groups and interests"
              inputName="groupTags"
              options={PREDEFINED_GROUP_TAG_OPTIONS}
              values={content.groupTags}
              maxItems={6}
              customLabel="Other / Custom"
              helpText="Choose a shared tag or write in your own."
            />
          </div>
        </section>

        <section aria-labelledby="profile-about-heading" className="border-b border-white/10 pb-8">
          <SectionHeading
            id="profile-about-heading"
            icon={UserRound}
            iconClassName={isBright ? "border-[#ff8a70]/30 bg-[#ff8a70]/10 text-[#ffb29f]" : classicIcon}
            eyebrow="About"
            title="Background and identity"
            detail="Self-reported and optional. These details are never treated as verified credentials."
          />
          <div className="mt-5 grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
            <div>
              <div>
                <label htmlFor="profession" className="text-sm font-semibold text-slate-200">
                  Profession
                </label>
                <input
                  id="profession"
                  name="profession"
                  defaultValue={content.background.profession}
                  placeholder="Teacher, student, business owner..."
                  className={fieldClass}
                />
                <VisibilityToggle name="professionPublic" defaultChecked={content.background.professionPublic} />
              </div>

              <div className="mt-5">
                <label htmlFor="experience" className="text-sm font-semibold text-slate-200">
                  Experience
                </label>
                <textarea
                  id="experience"
                  name="experience"
                  rows={4}
                  defaultValue={content.background.experience}
                  placeholder="A short note about the perspective you bring."
                  className={`${fieldClass} resize-y`}
                />
                <VisibilityToggle name="experiencePublic" defaultChecked={content.background.experiencePublic} />
              </div>

              <div className="mt-5">
                <label htmlFor="politicalAffiliation" className="text-sm font-semibold text-slate-200">
                  Political affiliation
                </label>
                <select
                  id="politicalAffiliation"
                  name="politicalAffiliation"
                  defaultValue={content.background.politicalAffiliation}
                  className={fieldClass}
                >
                  <option value="">Do not include</option>
                  {POLITICAL_AFFILIATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <VisibilityToggle name="politicalAffiliationPublic" defaultChecked={content.background.politicalAffiliationPublic} />
              </div>
            </div>

            <ProfileTagInput inputName="identityTags" tags={content.identityTags} />
          </div>
        </section>

        <details className="group border-b border-white/10 pb-8">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <span className="flex items-start gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                  isBright ? "border-[#ffd166]/30 bg-[#ffd166]/10 text-[#ffe29a]" : classicIcon
                }`}
                aria-hidden="true"
              >
                <LinkIcon size={18} strokeWidth={1.8} />
              </span>
              <span>
                <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Links</span>
                <span className="mt-1.5 block text-lg font-semibold text-slate-100">Public links</span>
                <span className="mt-1 block text-sm text-slate-400">
                  {externalLinkCount ? `${externalLinkCount} added` : "Website and social accounts, if useful."}
                </span>
              </span>
            </span>
            <span className="text-sm font-semibold text-cyan-200 group-open:hidden">Add or edit</span>
            <span className="hidden text-sm font-semibold text-cyan-200 group-open:inline">Close</span>
          </summary>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {EXTERNAL_LINK_FIELDS.map((field) => (
              <div key={field.platform}>
                <label htmlFor={field.inputName} className="text-sm font-semibold text-slate-200">
                  {field.label}
                </label>
                <input
                  id={field.inputName}
                  name={field.inputName}
                  defaultValue={externalLinkValues.get(field.platform) ?? ""}
                  placeholder={field.placeholder}
                  inputMode="url"
                  className={fieldClass}
                />
              </div>
            ))}
          </div>
        </details>

        <div>
          <label className="flex items-start gap-3 text-sm leading-6 text-slate-300">
            <input
              type="checkbox"
              name="recentVotesPublic"
              defaultChecked={content.recentVotesPublic}
              className={`mt-1 ${checkboxClass}`}
            />
            <span>
              <span className="block font-semibold text-slate-200">Show recent votes on my public profile</span>
              <span className="block text-slate-500">You can turn this off at any time.</span>
            </span>
          </label>
        </div>

      </form>
    </section>
  );
}
