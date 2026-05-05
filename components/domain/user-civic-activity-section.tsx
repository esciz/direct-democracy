import Link from "next/link";

import type { UserCivicPetitionActivitySummary } from "@/types/domain";

type UserCivicActivitySectionProps = {
  signedPetitions: UserCivicPetitionActivitySummary[];
  progressingPetitions: UserCivicPetitionActivitySummary[];
};

const statusStyles: Record<UserCivicPetitionActivitySummary["status"], string> = {
  Active: "bg-slate-100 text-slate-700",
  "Seeking Sponsor": "bg-orange-50 text-orange-700",
  "Sponsor Found": "bg-civic-50 text-civic-700",
  Drafting: "bg-violet-50 text-violet-700",
};

function PetitionActivityCard({ petition }: { petition: UserCivicPetitionActivitySummary }) {
  return (
    <article className="rounded-3xl bg-slate-50 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusStyles[petition.status]}`}>
          {petition.status}
        </span>
        {petition.sponsorName ? (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            Sponsor: {petition.sponsorName}
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 text-lg font-semibold text-ink">{petition.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{petition.summary}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
          Signed {new Date(petition.signedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
        <Link
          href={`/petitions/${petition.petitionId}`}
          className="text-sm font-semibold text-civic-700 transition hover:text-civic-900"
        >
          View petition
        </Link>
      </div>
    </article>
  );
}

export function UserCivicActivitySection({ signedPetitions, progressingPetitions }: UserCivicActivitySectionProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Your Civic Activity</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">How your petition activity is moving forward</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          Track the petitions you&apos;ve signed and see which ones are moving closer to public sponsorship and real legislative action.
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-ink">Petitions Signed</h3>
            <p className="mt-1 text-sm text-slate-500">Every verified signature you&apos;ve added so far.</p>
          </div>
          <div className="space-y-4">
            {signedPetitions.length ? (
              signedPetitions.map((petition) => <PetitionActivityCard key={`${petition.petitionId}-${petition.signedAt}`} petition={petition} />)
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">
                You haven&apos;t signed any petitions yet.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-ink">Legislation in Progress</h3>
            <p className="mt-1 text-sm text-slate-500">Petitions you signed that have moved beyond the initial signature-gathering stage.</p>
          </div>
          <div className="space-y-4">
            {progressingPetitions.length ? (
              progressingPetitions.map((petition) => (
                <PetitionActivityCard key={`progress-${petition.petitionId}-${petition.signedAt}`} petition={petition} />
              ))
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">
                None of your signed petitions have progressed beyond the active stage yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
