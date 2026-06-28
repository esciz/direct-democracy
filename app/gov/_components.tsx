import type { ReactNode } from "react";

type GovCrmPageShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
};

export function GovCrmPageShell({ title, description, eyebrow = "GovCRM operations", children }: GovCrmPageShellProps) {
  return (
    <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <section className="border-b border-slate-800 pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-rose-100">
              Internal/private
            </span>
            <span className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
              Public records read-only
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-amber-400/20 bg-amber-400/10 p-3 text-sm leading-6 text-amber-100">
        GovCRM can reference public civic records. It cannot edit public votes, public records, source attribution, public sentiment, candidate records, or accountability data.
      </section>

      {children}
    </div>
  );
}

type GovEmptyCardProps = {
  title: string;
  description: string;
  metric?: string;
};

export function GovEmptyCard({ title, description, metric = "0" }: GovEmptyCardProps) {
  return (
    <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-sm font-semibold text-slate-200">{metric}</span>
      </div>
      <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
        No government workflow records have been imported or created for this module.
      </div>
    </article>
  );
}

export function GovPlaceholderGrid() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <GovEmptyCard title="New submissions" description="Track newly received service requests, filings, forms, comments, and resident requests." />
      <GovEmptyCard title="Documents awaiting extraction" description="Monitor uploaded PDFs, images, and forms that need text extraction or OCR review." />
      <GovEmptyCard title="Fields awaiting review" description="Review extracted submission and document fields before routing or publication." />
      <GovEmptyCard title="Cases needing assignment" description="Route submission-derived cases to departments and staff owners." />
      <GovEmptyCard title="Public comments pending review" description="Review public comments connected to meetings, service actions, and document intake." />
      <GovEmptyCard title="Upcoming meetings" description="Monitor agenda, minutes, video, transcript, and summary readiness." />
      <GovEmptyCard title="Top service categories" description="Aggregate service catalog activity without changing public civic data." />
      <GovEmptyCard title="Average response time" description="Measure service responsiveness from stored submission and case timestamps." />
    </section>
  );
}

export function GovModuleEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
      <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">
        Empty state only. No fake government data is displayed.
      </div>
    </section>
  );
}
