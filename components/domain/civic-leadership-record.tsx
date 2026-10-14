import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpenCheck, Handshake, Lightbulb, ListChecks, Sprout } from "lucide-react";

import { getCivicLeadershipRecord, type LeadershipDimensionKey } from "@/lib/profile/leadership";

type CivicLeadershipRecordProps = {
  userId: string;
  variant?: "dark" | "light";
  isOwner?: boolean;
};

const DIMENSION_ICONS: Record<LeadershipDimensionKey, typeof BookOpenCheck> = {
  groundedKnowledge: BookOpenCheck,
  constructiveDeliberation: Handshake,
  initiative: Lightbulb,
  followThrough: ListChecks,
  communityRegard: BadgeCheck,
};

export async function CivicLeadershipRecord({ userId, variant = "dark", isOwner = false }: CivicLeadershipRecordProps) {
  const record = await getCivicLeadershipRecord(userId).catch(() => null);
  const dark = variant === "dark";

  if (!record) {
    return (
      <section className={dark ? "dd-panel-muted rounded-lg p-6" : "rounded-lg border border-slate-200 bg-white p-6 shadow-card"}>
        <h2 className={dark ? "text-xl font-semibold text-slate-50" : "text-xl font-semibold text-ink"}>Civic leadership record</h2>
        <p className={dark ? "mt-2 text-sm text-slate-400" : "mt-2 text-sm text-slate-600"}>This record could not be assembled right now.</p>
      </section>
    );
  }

  return (
    <section className={dark ? "dd-panel-muted rounded-lg p-5 sm:p-6" : "rounded-lg border border-white/70 bg-white/90 p-5 shadow-card sm:p-6"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${dark ? "text-emerald-200" : "text-civic-700"}`}>Civic leadership record</p>
          <h2 className={`mt-2 text-2xl font-semibold ${dark ? "text-slate-50" : "text-ink"}`}>{record.stage}</h2>
          <p className={`mt-2 text-sm leading-6 ${dark ? "text-slate-400" : "text-slate-600"}`}>{record.summary}</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${dark ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100" : "border-civic-200 bg-civic-50 text-civic-800"}`}>
          <Sprout size={14} aria-hidden="true" />
          Evidence, not popularity
        </span>
      </div>

      <div className={`mt-6 grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2 xl:grid-cols-5 ${dark ? "border-white/10 bg-white/10" : "border-slate-200 bg-slate-200"}`}>
        {record.dimensions.map((dimension) => {
          const Icon = DIMENSION_ICONS[dimension.key];
          return (
            <article key={dimension.key} className={dark ? "min-w-0 bg-[#0c1728] p-4" : "min-w-0 bg-white p-4"}>
              <div className="flex items-center justify-between gap-2">
                <Icon size={18} className={dark ? "text-cyan-200" : "text-civic-700"} aria-hidden="true" />
                <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${dimension.state === "Demonstrated" ? (dark ? "text-emerald-200" : "text-emerald-700") : dark ? "text-slate-500" : "text-slate-500"}`}>
                  {dimension.state}
                </span>
              </div>
              <h3 className={`mt-3 text-sm font-semibold ${dark ? "text-slate-100" : "text-ink"}`}>{dimension.label}</h3>
              <p className={`mt-2 text-xs leading-5 ${dark ? "text-slate-400" : "text-slate-600"}`}>{dimension.detail}</p>
              <p className={`mt-3 text-xs font-semibold ${dark ? "text-slate-300" : "text-slate-700"}`}>{dimension.evidenceCount} recorded signal{dimension.evidenceCount === 1 ? "" : "s"}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.42fr)]">
        <div>
          <h3 className={`text-sm font-semibold ${dark ? "text-slate-100" : "text-ink"}`}>Evidence from civic rooms</h3>
          {record.evidence.length ? (
            <div className={`mt-3 divide-y ${dark ? "divide-white/10 border-y border-white/10" : "divide-slate-200 border-y border-slate-200"}`}>
              {record.evidence.map((item) => (
                <Link key={`${item.kind}-${item.id}`} href={item.href} className={`block py-3 transition ${dark ? "hover:bg-white/[0.03]" : "hover:bg-slate-50"}`}>
                  <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${dark ? "text-slate-500" : "text-slate-500"}`}>{item.meta}</span>
                  <p className={`mt-1 text-sm font-semibold ${dark ? "text-slate-200" : "text-slate-800"}`}>{item.title}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className={`mt-3 border-y border-dashed py-4 text-sm ${dark ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-600"}`}>No public evidence has been recorded yet.</p>
          )}

          {record.acknowledgments.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {record.acknowledgments.map((acknowledgment) => (
                <span key={acknowledgment.label} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${dark ? "border-cyan-300/15 bg-cyan-500/8 text-cyan-100" : "border-civic-200 bg-civic-50 text-civic-800"}`}>
                  {acknowledgment.label} · {acknowledgment.count}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <aside className={`rounded-lg border p-4 ${dark ? "border-amber-300/18 bg-amber-500/8" : "border-amber-200 bg-amber-50"}`}>
          <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${dark ? "text-amber-200" : "text-amber-800"}`}>{isOwner ? "Your next practice" : "A useful next step"}</p>
          <h3 className={`mt-2 text-base font-semibold ${dark ? "text-slate-50" : "text-ink"}`}>{record.nextPractice.title}</h3>
          <p className={`mt-2 text-sm leading-6 ${dark ? "text-slate-400" : "text-slate-600"}`}>{record.nextPractice.detail}</p>
          {isOwner ? (
            <Link href={record.nextPractice.href} className={`mt-4 inline-flex items-center gap-2 text-sm font-semibold ${dark ? "text-amber-100 hover:text-white" : "text-amber-900 hover:text-amber-700"}`}>
              {record.nextPractice.actionLabel}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          ) : null}
        </aside>
      </div>

      <p className={`mt-5 border-t pt-4 text-xs leading-5 ${dark ? "border-white/10 text-slate-500" : "border-slate-200 text-slate-500"}`}>
        This is a descriptive record of public civic work. It is not a universal score, endorsement, or measure of a person's worth.
      </p>
    </section>
  );
}
