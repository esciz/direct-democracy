import Link from "next/link";

type SummaryBriefPanelProps = {
  eyebrow?: string;
  title: string;
  summary: string;
  bullets?: string[];
  signalChips?: string[];
  actionLabel?: string;
  actionHref?: string;
  actionLinks?: Array<{
    label: string;
    href: string;
  }>;
};

export function SummaryBriefPanel({
  eyebrow = "Civic Brief",
  title,
  summary,
  bullets = [],
  signalChips = [],
  actionLabel,
  actionHref,
  actionLinks = [],
}: SummaryBriefPanelProps) {
  return (
    <section className="rounded-[1.75rem] border border-civic-100 bg-[radial-gradient(circle_at_top_left,_rgba(236,253,245,0.8),_rgba(255,255,255,0.96)_40%,_rgba(239,246,255,0.95))] p-6 shadow-card backdrop-blur sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-civic-700">{eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">{summary}</p>
        </div>
        {actionLabel && actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>

      {signalChips.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {signalChips.map((chip) => (
            <span key={chip} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      {bullets.length ? (
        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3 rounded-[1.25rem] bg-white/90 px-4 py-3 ring-1 ring-slate-200">
              <span className="mt-1 h-2 w-2 rounded-full bg-civic-500" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {actionLinks.length ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {actionLinks.map((link) => (
            <Link key={`${link.href}-${link.label}`} href={link.href} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
