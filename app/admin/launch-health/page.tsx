import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";
type Release = { id: string; createdAt: string; metrics: Record<string, number>; coverageComplete: boolean };
type Integrity = { generatedAt: string; launchReady: boolean; findings: Array<{ id: string; severity: string; area: string; summary: string }> };
type Pipeline = { completedAt?: string; stagesSucceeded?: number; stagesFailed?: number; stagesSkipped?: number };
async function read<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path.join(process.cwd(), "data/generated", file), "utf8")) as T; } catch { return null; }
}
function date(value?: string) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }).format(new Date(value)) : "No completed run recorded";
}

export default async function LaunchHealthPage() {
  const user = await getCurrentUser();
  if (!["admin", "platform_admin"].includes(user.role)) redirect("/profile");
  const [release, integrity, meetings, civic] = await Promise.all([
    read<Release>("civic-data-release.json"), read<Integrity>("public-site-integrity-audit.json"),
    read<Pipeline>("meetings-pipeline-run.json"), read<Pipeline>("dataops-pipeline-run.json"),
  ]);
  const stale = !release || !Number.isFinite(Date.parse(release.createdAt)) || Date.now() - Date.parse(release.createdAt) > 24 * 3_600_000;
  const linkClass = "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-100";
  return <div className="space-y-6 pb-12">
    <PageIntro eyebrow="Launch operations" title="Published data and source health" description="Verify the data release served by this deployment and inspect incomplete source coverage." />
    <div className="flex flex-wrap gap-2">
      <Link className={linkClass} href="/admin/meeting-health">Meetings and minutes</Link>
      <Link className={linkClass} href="/admin/operations">Operations</Link>
      <Link className={linkClass} href="/api/data-release">Deployment release record</Link>
      <a className={linkClass} href="https://github.com/esciz/direct-democracy/actions/workflows/civic-data-production.yml" target="_blank" rel="noreferrer">Cloud refresh runs</a>
    </div>
    <section className={`rounded-2xl border p-5 ${stale ? "border-amber-300/30 bg-amber-500/10" : "border-white/10 bg-white/5"}`}>
      <h2 className="text-lg font-semibold text-slate-100">{release ? "This deployment’s data release" : "Publication has not been verified"}</h2>
      <p className="mt-2 text-sm text-slate-300">{release ? `Prepared ${date(release.createdAt)} Pacific.` : "The application is using its packaged data. A local refresh does not establish that new records reached this site."}</p>
      {release && <p className="mt-3 break-all font-mono text-xs text-slate-400">{release.id}</p>}
      {stale && <p className="mt-3 text-sm text-amber-100">Check the cloud refresh and deployment before treating source coverage as current.</p>}
    </section>
    {release && <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {[["Meeting records", "meetings"], ["Meeting topics", "meetingTopics"], ["Voting questions", "votingQuestions"], ["Financial entities", "financialEntities"], ["Ad filings", "adFilings"]].map(([label, key]) => <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-100">{(release.metrics[key] ?? 0).toLocaleString()}</p></div>)}
    </section>}
    <section className="grid gap-3 md:grid-cols-2">
      {[["Meetings refresh", meetings], ["Broader civic refresh", civic]].map(([label, report]) => {
        const run = report as Pipeline | null;
        return <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-slate-100">{String(label)}</h2><p className="mt-2 text-sm text-slate-400">{date(run?.completedAt)}</p><p className="mt-2 text-sm text-slate-300">{run?.completedAt ? `${run.stagesSucceeded ?? 0} stages succeeded; ${run.stagesFailed ?? 0} failed; ${run.stagesSkipped ?? 0} skipped.` : "A completed pipeline report is unavailable."}</p></div>;
      })}
    </section>
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-100">Source coverage requiring attention</h2>
      <p className="text-sm text-slate-400">{integrity ? `Integrity audit: ${date(integrity.generatedAt)} Pacific.` : "No integrity audit is available."} A published release can retain useful verified records while reporting incomplete coverage.</p>
      {(integrity?.findings ?? []).map((finding) => <article key={finding.id} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-wide text-amber-200">{finding.severity} · {finding.area}</p><p className="mt-2 text-sm leading-6 text-slate-300">{finding.summary}</p></article>)}
      {integrity?.findings?.length === 0 && <p className="text-sm text-slate-300">No findings were recorded in this audit. Confirm service and signup checks separately.</p>}
    </section>
  </div>;
}
