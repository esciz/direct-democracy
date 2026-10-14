import { createAdminPublicProfile } from "@/lib/admin/actions";
import type { AdminManagedProfileSummary } from "@/types/domain";

type AdminPublicProfileFormProps = {
  electionOptions: Array<{
    id: string;
    label: string;
  }>;
  profiles: AdminManagedProfileSummary[];
  error?: string;
  created?: string;
};

export function AdminPublicProfileForm({ electionOptions, profiles, error, created }: AdminPublicProfileFormProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Admin</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Create an unclaimed public profile</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            This creates a public-facing candidate or official profile without a linked platform account.
          </p>
        </div>

        {created === "success" ? (
          <div className="mt-5 rounded-2xl border border-civic-200 bg-civic-50 px-4 py-3 text-sm text-civic-900">
            Profile created successfully.
          </div>
        ) : null}

        <form action={createAdminPublicProfile} className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="text-sm font-semibold text-ink">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
            />
            {error === "name" ? <p className="mt-2 text-sm text-orange-700">Enter a valid name.</p> : null}
          </div>

          <div>
            <label htmlFor="profileType" className="text-sm font-semibold text-ink">
              Profile type
            </label>
            <select
              id="profileType"
              name="profileType"
              defaultValue="candidate"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
            >
              <option value="candidate">Candidate</option>
              <option value="official">Official</option>
              <option value="incumbentCandidate">Incumbent candidate</option>
            </select>
            {error === "profileType" ? <p className="mt-2 text-sm text-orange-700">Choose a valid profile type.</p> : null}
          </div>

          <div>
            <label htmlFor="bio" className="text-sm font-semibold text-ink">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={5}
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
            />
            {error === "bio" ? <p className="mt-2 text-sm text-orange-700">Use at least 20 characters.</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="jurisdictionName" className="text-sm font-semibold text-ink">
                Jurisdiction
              </label>
              <input
                id="jurisdictionName"
                name="jurisdictionName"
                type="text"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
              {error === "jurisdiction" ? <p className="mt-2 text-sm text-orange-700">Enter a jurisdiction.</p> : null}
            </div>
            <div>
              <label htmlFor="partyText" className="text-sm font-semibold text-ink">
                Party
              </label>
              <input
                id="partyText"
                name="partyText"
                type="text"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="officeTitle" className="text-sm font-semibold text-ink">
                Office title
              </label>
              <input
                id="officeTitle"
                name="officeTitle"
                type="text"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
              {error === "officeTitle" ? <p className="mt-2 text-sm text-orange-700">Officials need an office title.</p> : null}
            </div>
            <div>
              <label htmlFor="donationUrl" className="text-sm font-semibold text-ink">
                Donation link
              </label>
              <input
                id="donationUrl"
                name="donationUrl"
                type="url"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="websiteUrl" className="text-sm font-semibold text-ink">
              Website link
            </label>
            <input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
            />
          </div>

          <div>
            <label htmlFor="electionId" className="text-sm font-semibold text-ink">
              Associated election
            </label>
            <select
              id="electionId"
              name="electionId"
              defaultValue=""
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
            >
              <option value="">No election selected</option>
              {electionOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {error === "election" ? <p className="mt-2 text-sm text-orange-700">Candidates need an election.</p> : null}
          </div>

          <button
            type="submit"
            className="rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700"
          >
            Create profile
          </button>
        </form>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Public profiles</h2>
        <div className="mt-5 space-y-3">
          {profiles.map((profile) => (
            <div key={profile.id} className="rounded-3xl bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold text-ink">{profile.name}</p>
                <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                  {profile.profileType}
                </span>
                {!profile.isClaimed ? (
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
                    Unclaimed
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-slate-600">{profile.jurisdictionName}</p>
              {profile.officeTitle ? <p className="mt-2 text-sm text-slate-600">Office: {profile.officeTitle}</p> : null}
              {profile.electionTitle ? <p className="mt-2 text-sm text-slate-600">Election: {profile.electionTitle}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
