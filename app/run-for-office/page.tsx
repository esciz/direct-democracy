import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getLatestCandidateDraftForUser, getRunForOfficeOpportunities } from "@/lib/candidates/drafts";

export default async function RunForOfficePage() {
  const currentUser = await getCurrentUser();
  const [draft, opportunities] = await Promise.all([
    getLatestCandidateDraftForUser(currentUser.id),
    getRunForOfficeOpportunities(currentUser),
  ]);
  const startPath = draft ? `/run-for-office/races/${draft.electionId}` : opportunities[0] ? `/run-for-office/races/${opportunities[0].electionId}` : "/run-for-office/races";

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Run for Office"
        title="Explore what running for office could look like"
        description="This is a low-pressure planning space. You can learn how it works, browse races tied to your community, and build a draft candidate profile before anything becomes public."
        meta={
          <>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              Platform exploration only
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Official filing still happens elsewhere
            </span>
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Learn</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Learn how it works</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Start with general guidance on office types, basic requirements, filing resources, and how to build support.
          </p>
          <Link
            href="/run-for-office/guide"
            className="mt-6 inline-flex rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Learn how it works
          </Link>
        </article>

        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Races</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Explore available races</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Review upcoming races connected to your community and see what each office would involve at a high level.
          </p>
          <Link
            href="/run-for-office/races"
            className="mt-6 inline-flex rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Explore available races
          </Link>
        </article>

        <article className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-6 shadow-card">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Draft</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Start candidate profile</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Build a draft with your bio and campaign promises. Nothing becomes public until you choose to publish.
          </p>
          <Link
            href={startPath}
            className="mt-6 inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {draft ? "Continue draft candidate profile" : "Start candidate profile"}
          </Link>
        </article>
      </section>

      {currentUser.role === "trustedCitizen" ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Why this starts with trusted citizens</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Trusted citizens already have visible issue interests, community followers, and public credibility on the platform. This flow helps
            you explore whether that civic foundation should turn into a public candidate presence.
          </p>
        </section>
      ) : null}
    </div>
  );
}
