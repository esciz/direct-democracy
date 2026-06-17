import Link from "next/link";

export function MissingCandidateInfoCard({
  candidateId,
  missingFields,
  suggestedSearchQuery,
}: {
  candidateId: string;
  missingFields: string[];
  suggestedSearchQuery: string;
}) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(suggestedSearchQuery)}`;

  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">What we still need to verify</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Profile gaps are visible on purpose</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Missing candidate facts stay labeled until a real source is added, reviewed, and approved.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(missingFields.length ? missingFields : ["No major profile gaps detected"]).map((field) => (
          <div key={field} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-slate-100">{field}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {missingFields.length ? "Needs a source before it can appear publicly." : "Stored source coverage looks complete for this field set."}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/admin/data-factory/candidate-knowledge/add-source?candidateId=${candidateId}`} className="dd-button-primary rounded-full px-4 py-3 text-sm font-semibold">
          Submit source
        </Link>
        <Link href={`/claim-profile/${candidateId}`} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100">
          Claim/update profile
        </Link>
        <Link href={searchUrl} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100">
          Search web manually
        </Link>
        <Link
          href={`/admin/data-factory/candidate-knowledge/add-source?candidateId=${candidateId}&sourceType=campaign_site`}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
        >
          Add campaign website URL
        </Link>
      </div>
    </section>
  );
}
