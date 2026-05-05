import type { CommunitySnapshotBreakdownItem, CommunitySnapshotSummary } from "@/types/domain";

type CommunitySnapshotProps = {
  snapshot: CommunitySnapshotSummary;
};

function SnapshotBarGroup({
  title,
  items,
}: {
  title: string;
  items: CommunitySnapshotBreakdownItem[];
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-700">{item.label}</p>
              <p className="text-sm font-semibold text-slate-900">{item.percentage}%</p>
            </div>
            <div className="mt-2 h-3 rounded-full bg-slate-200">
              <div className="h-3 rounded-full bg-slate-950" style={{ width: `${item.percentage}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommunitySnapshot({ snapshot }: CommunitySnapshotProps) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-6 shadow-card sm:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Community Snapshot</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">High-level community context</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{snapshot.labelNote}</p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <SnapshotBarGroup title="Registered voter breakdown" items={snapshot.registeredVoterBreakdown} />
        <SnapshotBarGroup title="Age distribution" items={snapshot.ageDistribution} />
        <SnapshotBarGroup title="Gender" items={snapshot.genderDistribution} />
      </div>
    </section>
  );
}
