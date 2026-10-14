import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";
import { getPublicBallotMeasures } from "@/lib/civic-data/public";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(value);
}

function getOutcome(value: boolean | null) {
  if (value === true) return "Passed";
  if (value === false) return "Failed";
  return "Pending";
}

export default async function BallotMeasuresPage() {
  const measures = await getPublicBallotMeasures();

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Ballot measures"
        title="Nevada ballot questions"
        description="Imported statewide ballot questions and initiative petition records with source attribution."
        actions={
          <Link href="/elections" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
            Elections
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-2">
        {measures.length > 0 ? (
          measures.map((measure) => (
            <article key={measure.id} className="rounded-[1.5rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">{measure.questionNumber ?? "Ballot question"}</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">{measure.title}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{getOutcome(measure.passed)}</span>
              </div>
              {measure.summary ? <p className="mt-3 text-sm leading-6 text-slate-600">{measure.summary}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">{measure.jurisdictionName}</span>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{formatDate(measure.electionDate)}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{measure.petitionStatus.replaceAll("_", " ")}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>Source: {measure.source?.name ?? "No source"}</span>
                {measure.fullTextUrl ? (
                  <a href={measure.fullTextUrl} target="_blank" rel="noreferrer" className="font-semibold text-civic-700 hover:text-civic-900">
                    Official text
                  </a>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-6 text-sm text-slate-600 shadow-card backdrop-blur lg:col-span-2">
            No imported ballot measures are available yet.
          </div>
        )}
      </section>
    </div>
  );
}
