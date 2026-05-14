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
    <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200">
      <span className="text-slate-400">{label}</span>{" "}
      <span className="text-white">{value}</span>
    </div>
  );
}

export function ProfileFollowerSnapshot({ snapshot }: ProfileFollowerSnapshotProps) {
  return (
    <section className="dd-panel-muted rounded-[1.5rem] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Follower Snapshot</p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Based on {snapshot.visibleFollowerCount} visible in-app follower{snapshot.visibleFollowerCount === 1 ? "" : "s"}.
            This is a lightweight constituency snapshot, not a full audience census.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Ideological mix</p>
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
        <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Reach breakdown</p>
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
        <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Strongest visible places</p>
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
