import { FilterTabs } from "@/components/ui/filter-tabs";
import type { CommunitySnapshotSummary, IssueComparisonRow } from "@/types/domain";

type CommunityComparisonSectionProps = {
  mode: "issues" | "demographics";
  tabs: Array<{
    label: string;
    href: string;
    active: boolean;
  }>;
  selectedCommunityName: string;
  issueRows: IssueComparisonRow[];
  selectedSnapshot: CommunitySnapshotSummary;
  stateSnapshot: CommunitySnapshotSummary;
  nationalSnapshot: CommunitySnapshotSummary;
};

function ComparisonHeader({
  mode,
  tabs,
}: {
  mode: "issues" | "demographics";
  tabs: Array<{
    label: string;
    href: string;
    active: boolean;
  }>;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">How This Community Compares</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          {mode === "issues" ? "Platform issue priorities vs wider sentiment" : "Estimated registration and demographic context"}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          {mode === "issues"
            ? "Platform-generated issue priorities from user profiles, shown against statewide and national patterns."
            : "Estimated registered voter and demographic data used as seeded community context, clearly separate from platform behavior."}
        </p>
      </div>
      <FilterTabs tabs={tabs} />
    </div>
  );
}

function IssuesTable({
  rows,
  selectedCommunityName,
}: {
  rows: IssueComparisonRow[];
  selectedCommunityName: string;
}) {
  return (
    <div className="mt-6 overflow-x-auto">
      <div className="min-w-[42rem] space-y-3">
        <div className="grid grid-cols-[1.7fr,1fr,1fr,1fr] gap-3 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          <span>Issue</span>
          <span>{selectedCommunityName}</span>
          <span>Nevada</span>
          <span>United States</span>
        </div>
        {rows.length ? (
          rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[1.7fr,1fr,1fr,1fr] gap-3 rounded-3xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-ink">{row.label}</p>
              <p className="text-sm font-semibold text-civic-700">{row.selectedCommunityPercentage}%</p>
              <p className="text-sm font-semibold text-slate-700">{row.statePercentage}%</p>
              <p className="text-sm font-semibold text-slate-700">{row.nationalPercentage}%</p>
            </div>
          ))
        ) : (
          <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">Comparison data will appear once issues are available.</div>
        )}
      </div>
    </div>
  );
}

function SnapshotTable({
  title,
  rows,
  selectedCommunityName,
}: {
  title: string;
  rows: SnapshotComparisonRow[];
  selectedCommunityName: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
          Estimated registered voter data
        </span>
      </div>
      <div className="grid grid-cols-[1.7fr,1fr,1fr,1fr] gap-3 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        <span>Group</span>
        <span>{selectedCommunityName}</span>
        <span>Nevada</span>
        <span>United States</span>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[1.7fr,1fr,1fr,1fr] gap-3 rounded-3xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-ink">{row.label}</p>
          <p className="text-sm font-semibold text-civic-700">{row.selected}%</p>
          <p className="text-sm font-semibold text-slate-700">{row.state}%</p>
          <p className="text-sm font-semibold text-slate-700">{row.national}%</p>
        </div>
      ))}
    </div>
  );
}

function buildSnapshotRows(
  selected: CommunitySnapshotSummary["registeredVoterBreakdown"],
  state: CommunitySnapshotSummary["registeredVoterBreakdown"],
  national: CommunitySnapshotSummary["registeredVoterBreakdown"],
): SnapshotComparisonRow[] {
  return selected.map((item) => ({
    label: item.label,
    selected: item.percentage,
    state: state.find((entry) => entry.label === item.label)?.percentage ?? 0,
    national: national.find((entry) => entry.label === item.label)?.percentage ?? 0,
  }));
}

export function CommunityComparisonSection({
  mode,
  tabs,
  selectedCommunityName,
  issueRows,
  selectedSnapshot,
  stateSnapshot,
  nationalSnapshot,
}: CommunityComparisonSectionProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <ComparisonHeader mode={mode} tabs={tabs} />

      {mode === "issues" ? (
        <IssuesTable rows={issueRows} selectedCommunityName={selectedCommunityName} />
      ) : (
        <div className="mt-6 space-y-6">
          <SnapshotTable
            title="Registered voter breakdown"
            rows={buildSnapshotRows(
              selectedSnapshot.registeredVoterBreakdown,
              stateSnapshot.registeredVoterBreakdown,
              nationalSnapshot.registeredVoterBreakdown,
            )}
            selectedCommunityName={selectedCommunityName}
          />
          <SnapshotTable
            title="Age distribution"
            rows={buildSnapshotRows(selectedSnapshot.ageDistribution, stateSnapshot.ageDistribution, nationalSnapshot.ageDistribution)}
            selectedCommunityName={selectedCommunityName}
          />
          <SnapshotTable
            title="Gender"
            rows={buildSnapshotRows(selectedSnapshot.genderDistribution, stateSnapshot.genderDistribution, nationalSnapshot.genderDistribution)}
            selectedCommunityName={selectedCommunityName}
          />
        </div>
      )}
    </section>
  );
}
type SnapshotComparisonRow = {
  label: string;
  selected: number;
  state: number;
  national: number;
};
