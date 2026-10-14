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
      <section className="dd-panel-muted rounded-lg p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Activity</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-50">Recent contributions</h2>
        <p className="mt-2 text-sm text-slate-400">Activity could not be loaded right now. The rest of your profile is still available.</p>
      </section>
    );
  }

  const totalCount = COUNT_LABELS.reduce((total, entry) => total + summary.counts[entry.key], 0);

  return (
    <section className="dd-panel-muted rounded-lg p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Activity</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-50">Recent contributions</h2>
          <p className="mt-2 text-sm text-slate-400">{totalCount} public contribution{totalCount === 1 ? "" : "s"} across your civic activity.</p>
        </div>
        <Link
          href="/profile/activity"
          className="text-sm font-semibold text-cyan-200 hover:text-cyan-100"
        >
          View all activity
        </Link>
      </div>

      <div className="mt-5 border-y border-white/10">
        {summary.recentItems.length ? (
          <div className="divide-y divide-white/10">
            {summary.recentItems.map((item) => (
              <Link
                key={`${item.kind}-${item.id}`}
                href={item.href}
                className="block py-4 transition hover:bg-white/[0.03]"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.meta}</span>
                <p className="mt-2 text-sm font-semibold text-slate-100">{item.title}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-5 text-sm text-slate-400">No public activity yet.</div>
        )}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-300 hover:text-white">Contribution counts</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {COUNT_LABELS.map((entry) => (
            <div key={entry.key} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <span className="text-slate-400">{entry.label}</span>
              <span className="font-semibold text-slate-100">{summary.counts[entry.key]}</span>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
