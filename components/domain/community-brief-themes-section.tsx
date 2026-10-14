import { ActionLabel, ThumbsUpIcon } from "@/components/ui/action-icons";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { createCommunityBriefTheme, toggleBriefThemeSupport } from "@/lib/cases/actions";
import type { AuthUser, CommunityBriefThemeSummary } from "@/types/domain";

type CommunityBriefThemesSectionProps = {
  caseId: string;
  themes: CommunityBriefThemeSummary[];
  user: AuthUser;
  returnPath: string;
};

export function CommunityBriefThemesSection({ caseId, themes, user, returnPath }: CommunityBriefThemesSectionProps) {
  const canCreate = user.role === "trustedCitizen" || user.role === "admin";

  return (
    <section className="space-y-4">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Community brief themes</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Public-interest themes people want reviewed</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          These are not legal briefs. They are community-backed themes that could later be reviewed by legal partners.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-4">
          {themes.length ? (
            themes.map((theme) => (
              <article key={theme.id} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {theme.supportCount} supporters
                  </span>
                  <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">{theme.creatorName}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-ink">{theme.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{theme.description}</p>
                <div className="mt-5">
                  <form action={toggleBriefThemeSupport}>
                    <input type="hidden" name="themeId" value={theme.id} />
                    <input type="hidden" name="caseId" value={caseId} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <FormSubmitButton
                      idleLabel={<ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>{theme.viewerSupports ? "Supporting theme" : "Support theme"}</ActionLabel>}
                      pendingLabel={<ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>Saving...</ActionLabel>}
                      disabled={!user.isVerifiedVoter}
                      className={
                        theme.viewerSupports
                          ? "rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                          : "rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                      }
                    />
                  </form>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/75 p-6 text-sm text-slate-600 shadow-card">
              No community brief themes yet for this case.
            </div>
          )}
        </div>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
          <h3 className="text-xl font-semibold tracking-tight text-ink">Suggest a theme</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Trusted citizens can add concise public-interest themes that others can support.
          </p>
          {canCreate ? (
            <form action={createCommunityBriefTheme} className="mt-5 space-y-4">
              <input type="hidden" name="caseId" value={caseId} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <input
                name="title"
                placeholder="Theme title"
                className="w-full rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
              <textarea
                name="description"
                rows={5}
                placeholder="Describe the public-interest argument or community impact you think deserves review."
                className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
              <FormSubmitButton
                idleLabel="Create theme"
                pendingLabel="Saving..."
                className="rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              />
            </form>
          ) : (
            <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">
              Only trusted citizens can create new community brief themes in this MVP, but anyone verified can support them.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
