import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseNevadaPublicNoticeLeads, parseSchoolParticipationLeads, sourceLinks, type NevadaMeetingSourceLead } from "@/lib/public-meetings/nevada-agency-sources";
import type { PublicMeetingSourceSeed } from "@/lib/public-meetings/types";

type SourceObservation = NevadaMeetingSourceLead & {
  firstSeenAt: string;
  lastSeenAt: string;
  registeredProviderId: string | null;
};
type SourceReport = { url: string; status: "ok" | "error"; leads: number; error?: string };
type DiscoveryOutput = { generatedAt: string; leads: SourceObservation[]; sourceReports: SourceReport[]; notes: string[] };

async function main() {
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const outputPath = path.resolve(outputArg ?? "data/generated/nevada-meeting-source-discovery.json");
  const maxPages = Math.min(80, Math.max(1, Number(process.argv.find((arg) => arg.startsWith("--max-pages="))?.slice("--max-pages=".length) ?? 36)));
  if (!Number.isFinite(maxPages)) throw new Error("--max-pages must be a finite positive number");
  const seeds = JSON.parse(await readFile("data/seed/public-meeting-sources.json", "utf8")) as PublicMeetingSourceSeed[];
  const now = new Date().toISOString();
  const prior: DiscoveryOutput | null = existsSync(outputPath) ? JSON.parse(await readFile(outputPath, "utf8")) as DiscoveryOutput : null;
  const priorById = new Map((prior?.leads ?? []).map((lead) => [lead.id, lead]));
  const observations = new Map(priorById);
  const reports: SourceReport[] = [];
  const visited = new Set<string>();
  const directoryUrl = "https://doe.nv.gov/school-and-district-information";
  const noticeUrl = "https://notice.nv.gov/";
  const prioritySchoolUrl = "https://www.carsoncityschools.com/";
  const queue = [noticeUrl, directoryUrl, prioritySchoolUrl, "https://www.carsoncityschools.com/families-and-students/calendars", "https://www.nevadapta.org/", "https://doe.nv.gov/boards-commissions-councils/publicmeetings/"];
  const explicitRoots = new Set(queue);
  const schoolRoots = new Set(["www.carsoncityschools.com"]);
  const normalizeHost = (url: string) => new URL(url).hostname.replace(/^www\./, "");
  function registeredProvider(url: string | null) {
    if (!url) return null;
    return seeds.find((seed) => !seed.platformHints?.includes("discovery_only") && [seed.meetingIndexUrl, ...(seed.discoveryUrls ?? [])].some((root) => root && url.replace(/\/$/, "") === root.replace(/\/$/, "")))?.id ?? null;
  }
  while (queue.length && visited.size < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      // Only explicit public roots and schools linked by the official state directory are crawled.
      // Notice URLs remain review leads; no arbitrary new agency host is recursively fetched.
      const allowed = explicitRoots.has(url) || [...schoolRoots].some((host) => new URL(url).hostname === host || new URL(url).hostname.endsWith(`.${host.replace(/^www\./, "")}`));
      if (!allowed) continue;
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "Direct Democracy public meeting source discovery", accept: "text/html" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!/text\/html/i.test(response.headers.get("content-type") ?? "")) throw new Error("Expected an HTML source directory");
      const html = await response.text();
      if (html.length > 8_000_000) throw new Error("Source directory exceeds the bounded HTML size");
      let leads = url === noticeUrl ? parseNevadaPublicNoticeLeads(html, url) : parseSchoolParticipationLeads(html, url);
      if (url.includes("/publicmeetings")) {
        leads = sourceLinks(html, url).filter((link) => /subcommittee|advisory|council|commission|public meeting/i.test(link.label)).map((link) => ({
          id: `education-discovery-${createHash("sha256").update(link.href).digest("hex").slice(0, 20)}`,
          bodyName: link.label, sourceUrl: link.href, discoveredFrom: url, meetingDate: null, cancelled: false,
          status: "needs_source_review", sourceKind: "official_notice",
        }));
      }
      for (const lead of leads) {
        const previous = priorById.get(lead.id);
        observations.set(lead.id, { ...lead, firstSeenAt: previous?.firstSeenAt ?? now, lastSeenAt: now, registeredProviderId: registeredProvider(lead.sourceUrl) });
      }
      if (url === directoryUrl) {
        const districts = sourceLinks(html, url).filter((link) => /School District/i.test(link.label) && normalizeHost(link.href) !== normalizeHost(directoryUrl));
        for (const district of districts) { schoolRoots.add(new URL(district.href).hostname); queue.push(district.href); }
      }
      // Carson City comes first, then one public directory/calendar per other district.
      if (url === prioritySchoolUrl || (url !== directoryUrl && [...schoolRoots].some((host) => normalizeHost(url) === host.replace(/^www\./, "")))) {
        const candidates = sourceLinks(html, url).filter((link) => {
          const parentHost = normalizeHost(url);
          const host = normalizeHost(link.href);
          const schoolHomepage = host.endsWith(`.${parentHost}`) && new URL(link.href).pathname === "/";
          return (host === parentHost || host.endsWith(`.${parentHost}`)) && (schoolHomepage || /calendar|pta|pto|ptsa|parent teacher|elementary|school directory/i.test(`${link.label} ${new URL(link.href).pathname.replace(/[-_]/g, " ")}`));
        });
        const candidateUrls = [...new Set(candidates.map((link) => link.href))];
        if (url === prioritySchoolUrl) queue.unshift(...candidateUrls.slice(0, 12));
        else queue.push(...candidateUrls.slice(0, 2));
      }
      reports.push({ url, status: "ok", leads: leads.length });
      console.log(`${url}: ${leads.length} source leads`);
    } catch (error) {
      reports.push({ url, status: "error", leads: 0, error: error instanceof Error ? error.message : String(error) });
      console.error(`${url}: ${reports.at(-1)?.error}`);
    }
  }
  const output: DiscoveryOutput = {
    generatedAt: now,
    leads: [...observations.values()].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt) || a.bodyName.localeCompare(b.bodyName)),
    sourceReports: reports,
    notes: [
      "This is a review queue, not a claim that linked bodies or their minutes are ingested. Review a lead's official archive and select an adapter before registering it.",
      "Retained leads include first/last observation timestamps. Disappearance from a calendar never deletes a public record or proves cancellation.",
      "Carson City public school sources are visited first. The state directory supplies all Nevada district roots; bounded runs may leave deeper school pages for subsequent source onboarding.",
      "PTA/PTO meetings have no assumed recurrence or government minutes deadline. Private portals are not crawled; organizers can submit a public calendar, event notice, or minutes through the existing event/source intake.",
    ],
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`);
  await rename(temporaryPath, outputPath);
  console.log(`Saved ${output.leads.length} source leads; ${reports.filter((report) => report.status === "error").length} fetch errors. ${outputPath}`);
  if (!reports.some((report) => report.status === "ok")) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
