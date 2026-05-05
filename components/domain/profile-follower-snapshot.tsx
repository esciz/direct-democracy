import type { FollowerSnapshotSummary } from "@/lib/social/follows";

type ProfileFollowerSnapshotProps = {
  snapshot: FollowerSnapshotSummary;
};

function SnapshotPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
      <span className="text-slate-500">{label}</span>{" "}
      <span className="text-slate-900">{value}</span>
    </div>
  );
}

export function ProfileFollowerSnapshot({ snapshot }: ProfileFollowerSnapshotProps) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.42)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Follower Snapshot</p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Based on {snapshot.visibleFollowerCount} visible in-app follower{snapshot.visibleFollowerCount === 1 ? "" : "s"}.
            This is a lightweight constituency snapshot, not a full audience census.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Ideological mix</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {snapshot.ideologicalMix.map((entry) => (
              <SnapshotPill
                key={entry.label}
                label={entry.label}
                value={`${entry.percentage}%`}
              />
            ))}
          </div>
        </div>
        <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Reach breakdown</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {snapshot.reachBreakdown.map((entry) => (
              <SnapshotPill
                key={entry.label}
                label={entry.label}
                value={`${entry.percentage}%`}
              />
            ))}
          </div>
        </div>
        <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Strongest visible places</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {snapshot.topJurisdictions.map((entry) => (
              <SnapshotPill
                key={entry.label}
                label={entry.label}
                value={`${entry.count}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
