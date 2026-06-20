import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type OrganizationReport = {
  organizationId: string;
  bodyName: string;
  jurisdiction: string | null;
  meetingsImported: number;
  agendas: number;
  packets: number;
  minutes: number;
  attendanceCoverage: number;
  voteCoverage: number;
  namedVoteCoverage: number;
  aggregateVoteCoverage: number;
  readinessScore: number;
};

type ReadinessArtifact = {
  generatedAt: string;
  organizationReports: OrganizationReport[];
  audit: {
    totals: Record<string, number>;
    sourceTypeCounts: Record<string, number>;
  };
};

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");

function readReadiness(): ReadinessArtifact | null {
  const filePath = path.join(GENERATED_DIR, "vote-attribution-readiness.json");
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as ReadinessArtifact;
}

export default function SourceCompletenessPage() {
  const readiness = readReadiness();
  const reports = readiness?.organizationReports ?? [];

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Internal operations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Source completeness dashboard</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Readiness is based on imported meetings, agendas, packets, minutes, attendance, vote outcomes, named votes, and roster matches. Low-readiness bodies are the next ingestion priorities.
        </p>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Meetings", readiness?.audit.totals.meetings ?? 0],
            ["With minutes", readiness?.audit.totals.meetingsWithMinutes ?? 0],
            ["With attendance", readiness?.audit.totals.meetingsWithAttendance ?? 0],
            ["With named votes", readiness?.audit.totals.meetingsWithNamedVotes ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-[minmax(220px,1.5fr)_repeat(8,minmax(80px,1fr))] gap-0 bg-white/[0.06] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            <span>Organization</span>
            <span>Meetings</span>
            <span>Agendas</span>
            <span>Packets</span>
            <span>Minutes</span>
            <span>Attendance</span>
            <span>Votes</span>
            <span>Named</span>
            <span>Score</span>
          </div>
          <div className="divide-y divide-white/10">
            {reports.length ? (
              reports.map((report) => (
                <div key={report.organizationId} className="grid grid-cols-[minmax(220px,1.5fr)_repeat(8,minmax(80px,1fr))] gap-0 px-4 py-3 text-sm text-slate-300">
                  <span>
                    <span className="block font-semibold text-slate-100">{report.bodyName}</span>
                    <span className="text-xs text-slate-500">{report.jurisdiction}</span>
                  </span>
                  <span>{report.meetingsImported}</span>
                  <span>{report.agendas}</span>
                  <span>{report.packets}</span>
                  <span>{report.minutes}</span>
                  <span>{report.attendanceCoverage}</span>
                  <span>{report.voteCoverage}</span>
                  <span>{report.namedVoteCoverage}</span>
                  <span className={report.readinessScore < 0.35 ? "text-amber-200" : "text-emerald-200"}>{Math.round(report.readinessScore * 100)}%</span>
                </div>
              ))
            ) : (
              <p className="p-5 text-sm text-slate-400">Run npm run attribution:readiness to generate source completeness data.</p>
            )}
          </div>
        </section>

        {readiness?.generatedAt ? <p className="mt-4 text-xs text-slate-500">Generated {new Date(readiness.generatedAt).toLocaleString()}</p> : null}
      </div>
    </main>
  );
}
