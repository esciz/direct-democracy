import Link from "next/link";
import type { ReactNode } from "react";

const govNavItems = [
  { href: "/gov/dashboard", label: "Dashboard" },
  { href: "/gov/catalogs", label: "Catalogs" },
  { href: "/gov/submissions", label: "Submissions" },
  { href: "/gov/cases", label: "Cases" },
  { href: "/gov/comments", label: "Comments" },
  { href: "/gov/documents", label: "Documents" },
  { href: "/gov/forms", label: "Forms" },
  { href: "/gov/public", label: "Portal Preview" },
  { href: "/gov/meetings", label: "Meetings" },
  { href: "/gov/reports", label: "Reports" },
  { href: "/gov/settings", label: "Settings" },
];

type GovCrmPageShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
};

export function GovCrmPageShell({ title, description, eyebrow = "Direct Democracy GovCRM / Government Workflow Layer", children }: GovCrmPageShellProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-2 sm:px-6 lg:px-8">
      <section className="rounded-[1.75rem] border border-emerald-300/20 bg-slate-950/80 p-5 shadow-[0_24px_80px_-48px_rgba(45,212,191,0.55)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{description}</p>
          </div>
          <Link
            href="/gov/settings"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-emerald-300/35 hover:text-emerald-100"
          >
            Separation rules
          </Link>
        </div>
        <nav className="mt-6 flex flex-wrap gap-2">
          {govNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-300/35 hover:bg-emerald-400/10 hover:text-emerald-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </section>

      <section className="rounded-[1.5rem] border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
        GovCRM is a private workflow surface. It can reference public civic data, but it cannot change public sentiment, voting data, criticism, candidate records, official records, or source attribution.
      </section>

      {children}
    </main>
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
