import Link from "next/link";

import { getSafeCivicActivitySummary } from "@/lib/server/profile-activity";

type ProfileCivicActivitySectionProps = {
  userId: string;
};

const COUNT_LABELS = [
  { key: "post", label: "Posts" },
  { key: "debate", label: "Debates" },
  { key: "petition", label: "Petitions" },
  { key: "event", label: "Events" },
  { key: "interview", label: "Interviews" },
  { key: "endorsement", label: "Endorsements" },
  { key: "caseContribution", label: "Case Contributions" },
] as const;

export async function ProfileCivicActivitySection({ userId }: ProfileCivicActivitySectionProps) {
  const summary = await getSafeCivicActivitySummary(userId).catch(() => null);

  if (!summary) {
    return (
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Civic Activity</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Recent public contributions</h2>
          <p className="mt-2 text-sm text-slate-600">
            Civic Activity could not be loaded right now, but the rest of your profile is still available.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Civic Activity</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Recent public contributions</h2>
          <p className="mt-2 text-sm text-slate-600">
            A compact summary of your authored civic work. This stays preview-only here so the profile page remains stable.
          </p>
        </div>
        <Link
          href="/profile/activity"
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          View All Activity
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COUNT_LABELS.map((entry) => (
          <div key={entry.key} className="rounded-3xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{entry.label}</p>
            <p className="mt-2 text-lg font-semibold text-ink">{summary.counts[entry.key]}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Recent preview</h3>
        <p className="mt-1 text-sm text-slate-600">Showing up to two recent public items only.</p>

        {summary.recentItems.length ? (
          <div className="mt-4 space-y-3">
            {summary.recentItems.map((item) => (
              <Link
                key={`${item.kind}-${item.id}`}
                href={item.href}
                className="block rounded-3xl bg-white p-4 transition hover:border-civic-200 hover:bg-civic-50/40"
              >
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item.meta}</span>
                <p className="mt-3 text-sm font-semibold text-ink">{item.title}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl bg-white px-4 py-3 text-sm text-slate-500">
            No public activity to preview yet.
          </div>
        )}
      </div>
    </section>
  );
}
