import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";
import { getImportedElectionSummaries } from "@/lib/elections/imported-store";
import type { ElectionSummary } from "@/types/domain";

type RaceGroupPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  filter: (election: ElectionSummary) => boolean;
};

export async function RaceGroupPage({ eyebrow, title, description, filter }: RaceGroupPageProps) {
  const elections = (await getImportedElectionSummaries()).filter(filter);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow={eyebrow}
        title={title}
        description={description}
        meta={
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Imported Nevada beta data
          </span>
        }
        actions={
          <Link href="/elections" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
            All elections
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-2">
        {elections.length ? (
          elections.map((election) => (
            <article key={election.id} className="rounded-[1.5rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{election.jurisdictionName}</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">{election.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{election.officeTitle}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{election.electionStatus}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
                  {new Date(election.electionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Imported Nevada beta data</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {(election.importedCandidates?.length ?? 0) + election.candidates.length} candidates
                </span>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                  {election.ballotInitiatives.length} ballot questions
                </span>
              </div>
              <Link href={`/elections/${election.id}`} className="mt-5 inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
                View election
              </Link>
            </article>
          ))
        ) : (
          <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-6 text-sm text-slate-600 shadow-card backdrop-blur lg:col-span-2">
            No imported Nevada election records match this grouping yet.
          </div>
        )}
      </section>
    </div>
  );
}
