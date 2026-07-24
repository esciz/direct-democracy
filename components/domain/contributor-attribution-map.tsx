import Link from "next/link";

import type { CampaignFinanceContributorAttribution } from "@/lib/civic-data/profile-source-cards";

type ContributorAmount = {
  name: string;
  amount: number;
};

const resolutionStyles: Record<
  CampaignFinanceContributorAttribution["resolution"],
  { label: string; className: string; dotClassName: string }
> = {
  verified: {
    label: "Explicit ownership",
    className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    dotClassName: "bg-emerald-300",
  },
  timeline: {
    label: "Dated timeline",
    className: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
    dotClassName: "bg-cyan-300",
  },
  partial: {
    label: "Partial structure",
    className: "border-sky-300/25 bg-sky-300/10 text-sky-100",
    dotClassName: "bg-sky-300",
  },
  reported: {
    label: "Reported control",
    className: "border-rose-300/25 bg-rose-300/10 text-rose-100",
    dotClassName: "bg-rose-300",
  },
  association: {
    label: "Association only",
    className: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    dotClassName: "bg-amber-300",
  },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatMoney(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function contributorAttributionId(name: string) {
  return `entity-trail-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

export function ContributorAttributionMap({
  attributions,
  contributors,
}: {
  attributions: CampaignFinanceContributorAttribution[];
  contributors: ContributorAmount[];
}) {
  if (!attributions.length) return null;

  const amounts = new Map(contributors.map((contributor) => [contributor.name.toLowerCase(), contributor.amount]));
  const evidenceCount = attributions.reduce((sum, attribution) => sum + attribution.relationships.length, 0);
  const explicitCount = attributions.filter((attribution) => attribution.resolution === "verified").length;

  return (
    <section className="mt-6 border-y border-white/10 py-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Entity attribution</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-50">Who is connected to these contributors?</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Public records reveal different kinds of relationships. Each link preserves the source date, the exact relationship supported, and the point where the public trail ends.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
          <span><strong className="text-base text-slate-100">{attributions.length}</strong> entities traced</span>
          <span><strong className="text-base text-slate-100">{evidenceCount}</strong> evidence links</span>
          <span><strong className="text-base text-emerald-200">{explicitCount}</strong> explicit owner record</span>
        </div>
      </div>

      <div className="mt-6 border-y border-white/10">
        {attributions.map((attribution) => {
          const resolution = resolutionStyles[attribution.resolution];
          const amount = formatMoney(amounts.get(attribution.contributorName.toLowerCase()));

          return (
            <article
              key={attribution.contributorName}
              id={contributorAttributionId(attribution.contributorName)}
              className="scroll-mt-24 border-b border-white/10 py-6 last:border-b-0"
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(13rem,0.7fr)_minmax(0,1.55fr)]">
                <div>
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${resolution.dotClassName}`} aria-hidden="true" />
                    <p className="text-base font-semibold text-slate-50">{attribution.contributorName}</p>
                  </div>
                  {amount ? <p className="mt-2 pl-[1.375rem] text-sm font-semibold text-slate-300">{amount} contributed</p> : null}
                  <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${resolution.className}`}>
                    {resolution.label}
                  </span>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-100">{attribution.headline}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{attribution.summary}</p>

                  <div className="relative mt-5 space-y-5 pl-7 before:absolute before:bottom-2 before:left-[0.3rem] before:top-2 before:w-px before:bg-white/15">
                    {attribution.relationships.map((relationship) => (
                      <div key={`${relationship.targetName}-${relationship.relationship}-${relationship.evidenceDate}`} className="relative">
                        <span className="absolute -left-7 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-cyan-200" aria-hidden="true" />
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{relationship.relationship}</p>
                            <p className="mt-1 text-base font-semibold text-slate-50">{relationship.targetName}</p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                            {relationship.confidence} confidence
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{relationship.note}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>{formatDate(relationship.evidenceDate)}</span>
                          <span>{relationship.evidenceType}</span>
                          <Link href={relationship.sourceUrl} className="font-semibold text-cyan-200 hover:text-cyan-100">
                            Open evidence
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-5 border-l-2 border-amber-300/40 pl-3 text-xs leading-5 text-amber-100/80">
                    {attribution.caveat}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
