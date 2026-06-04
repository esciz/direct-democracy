import { PageIntro } from "@/components/ui/page-intro";
import { getPublicOfficials } from "@/lib/civic-data/public";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value) : "Not recorded";
}

export default async function ImportedOfficialsPage() {
  let officials: Awaited<ReturnType<typeof getPublicOfficials>> = [];

  try {
    officials = await getPublicOfficials();
  } catch {
    officials = [];
  }

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Officials"
        title="Imported Nevada officials"
        description="A sample public directory powered by the normalized Nevada officials importer."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {officials.length > 0 ? (
          officials.map((official) => (
            <article key={official.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex gap-4">
                {official.photoUrl ? (
                  <img src={official.photoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg font-semibold text-slate-300">
                    {official.fullName
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                )}
                <div>
                  <h2 className="font-semibold text-slate-50">{official.fullName}</h2>
                  <p className="mt-1 text-sm text-slate-300">{official.office.title}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{official.status}</p>
                </div>
              </div>

              <dl className="mt-5 space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Jurisdiction</dt>
                  <dd className="text-slate-200">{official.jurisdiction.name}</dd>
                </div>
                {official.district ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">District</dt>
                    <dd className="text-slate-200">{official.district.name}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Term</dt>
                  <dd className="text-slate-200">
                    {formatDate(official.termStart)} to {formatDate(official.termEnd)}
                  </dd>
                </div>
                {official.partyText ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Party</dt>
                    <dd className="text-slate-200">{official.partyText}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                {official.websiteUrl ? (
                  <a href={official.websiteUrl} target="_blank" rel="noreferrer" className="dd-button-secondary rounded-full px-3 py-2 text-xs font-semibold">
                    Website
                  </a>
                ) : null}
                {official.email ? (
                  <a href={`mailto:${official.email}`} className="dd-button-secondary rounded-full px-3 py-2 text-xs font-semibold">
                    Email
                  </a>
                ) : null}
                {official.phone ? <span className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300">{official.phone}</span> : null}
              </div>

              {official.source ? <p className="mt-4 text-xs text-slate-500">Source: {official.source.name}</p> : null}
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400 md:col-span-2 xl:col-span-3">
            No imported officials are available yet. Run the Nevada data sources from the admin import controls.
          </div>
        )}
      </section>
    </div>
  );
}

