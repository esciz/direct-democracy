import Link from "next/link";

import { CandidateDirectoryCard } from "@/components/domain/candidate-directory-card";
import { PageIntro } from "@/components/ui/page-intro";
import { PreserveScrollQueryForm } from "@/components/ui/preserve-scroll-query-form";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCandidateProfiles } from "@/lib/server/elections-context";
import { getLightweightFollowState } from "@/lib/social/follows";
import type { PublicProfileSummary } from "@/types/domain";

type CandidatesPageProps = {
  searchParams?: Promise<{
    q?: string;
    sort?: string;
    office?: string;
    jurisdiction?: string;
    party?: string;
    year?: string;
    incumbent?: string;
    hasBio?: string;
    hasFinance?: string;
    hasIssues?: string;
    hasNews?: string;
    completeness?: string;
  }>;
};

type CandidateFilterMetadata = {
  id: string;
  name: string;
  officeTitle: string;
  officeGroup: string;
  jurisdictionName: string;
  partyText: string | null;
  electionYear: string;
  isIncumbent: boolean;
  hasBio: boolean;
  hasFinance: boolean;
  hasIssues: boolean;
  hasNews: boolean;
  completenessScore: number;
  completenessLabel: "complete" | "substantial" | "needs_sources";
  updatedAt: Date;
};

function normalizeOfficeGroup(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("governor")) return "Governor";
  if (normalized.includes("attorney general")) return "Attorney General";
  if (normalized.includes("secretary of state")) return "Secretary of State";
  if (normalized.includes("treasurer")) return "Treasurer";
  if (normalized.includes("u.s. senate") || normalized.includes("us senate") || normalized.includes("united states senate")) return "U.S. Senate";
  if (normalized.includes("u.s. house") || normalized.includes("us house") || normalized.includes("congress") || normalized.includes("representative")) return "U.S. House";
  if (normalized.includes("state senate") || /\bsenate\b/.test(normalized)) return "State Senate";
  if (normalized.includes("assembly")) return "State Assembly";
  if (normalized.includes("assessor")) return "County Assessor";
  if (normalized.includes("commission")) return "County Commission";
  if (normalized.includes("mayor")) return "Mayor";
  if (normalized.includes("city council") || normalized.includes("council")) return "City Council";
  if (normalized.includes("school")) return "School Board";
  if (normalized.includes("judge") || normalized.includes("court") || normalized.includes("justice")) return "Judge";
  return value || "Office not listed";
}

function candidateYear(value: Date | null, title: string) {
  return value?.getUTCFullYear().toString() ?? title.match(/\b(20\d{2})\b/)?.[1] ?? "Unknown";
}

function completenessLabel(score: number): CandidateFilterMetadata["completenessLabel"] {
  if (score >= 80) return "complete";
  if (score >= 50) return "substantial";
  return "needs_sources";
}

function matchesText(query: string, ...values: Array<string | null | undefined>) {
  if (!query) return true;
  const normalized = query.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

function selectedBoolean(value: string | undefined) {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function buildQuery(params: Record<string, string | undefined>, overrides: Record<string, string | null>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...overrides })) {
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `/candidates?${text}` : "/candidates";
}

function optionCounts<T extends string>(items: CandidateFilterMetadata[], getValue: (item: CandidateFilterMetadata) => T | null | undefined) {
  const counts = new Map<T, number>();
  for (const item of items) {
    const value = getValue(item);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

async function attachCandidateFollowState(viewerId: string, candidates: PublicProfileSummary[]) {
  return Promise.all(
    candidates.map(async (candidate) => {
      if (!candidate.claimedByUserId) return candidate;
      const followState = await getLightweightFollowState(viewerId, candidate.claimedByUserId, candidate.followerCount ?? 0);
      return {
        ...candidate,
        followerCount: followState.followerCount,
        viewerIsFollowing: followState.viewerIsFollowing,
        viewerCanFollow: followState.viewerCanFollow,
      };
    }),
  );
}

async function getCandidateFilterMetadata() {
  const rows = await prisma.candidate.findMany({
    include: {
      election: { select: { title: true, electionDate: true } },
      office: { select: { title: true } },
      jurisdiction: { select: { name: true } },
      knowledgeEnrichments: {
        where: { reviewStatus: { in: ["APPROVED", "VERIFIED"] } },
        select: { aboutSummary: true },
        take: 1,
      },
      campaignFinanceFilings: { select: { id: true }, take: 1 },
      issuePositions: { select: { id: true }, take: 1 },
      newsMentions: { select: { id: true }, take: 1 },
    },
    orderBy: [{ updatedAt: "desc" }, { fullName: "asc" }],
  });

  return rows.map((candidate): CandidateFilterMetadata => {
    const officeTitle = candidate.office?.title ?? candidate.election.title;
    const hasBio = Boolean(candidate.campaignStatement) || candidate.knowledgeEnrichments.some((entry) => Boolean(entry.aboutSummary));
    const hasFinance = candidate.campaignFinanceFilings.length > 0;
    const hasIssues = candidate.issuePositions.length > 0;
    const hasNews = candidate.newsMentions.length > 0;
    const completenessScore = [hasBio, hasFinance, hasIssues, hasNews].filter(Boolean).length * 25;
    return {
      id: candidate.id,
      name: candidate.ballotName ?? candidate.fullName,
      officeTitle,
      officeGroup: normalizeOfficeGroup(officeTitle),
      jurisdictionName: candidate.jurisdiction.name,
      partyText: candidate.partyText,
      electionYear: candidateYear(candidate.election.electionDate, candidate.election.title),
      isIncumbent: candidate.isIncumbent,
      hasBio,
      hasFinance,
      hasIssues,
      hasNews,
      completenessScore,
      completenessLabel: completenessLabel(completenessScore),
      updatedAt: candidate.updatedAt,
    };
  });
}

export default async function CandidatesPage({ searchParams }: CandidatesPageProps) {
  const user = await getCurrentUser();
  const params = (searchParams ? await searchParams : {}) ?? {};
  const query = params.q?.trim() ?? "";
  const sort = params.sort ?? "updated";
  const hasBio = selectedBoolean(params.hasBio);
  const hasFinance = selectedBoolean(params.hasFinance);
  const hasIssues = selectedBoolean(params.hasIssues);
  const hasNews = selectedBoolean(params.hasNews);

  const [metadataRows, profiles] = await Promise.all([getCandidateFilterMetadata(), attachCandidateFollowState(user.id, await getCandidateProfiles())]);
  const metadataById = new Map(metadataRows.map((row) => [row.id, row]));
  const realProfiles = profiles.filter((profile) => metadataById.has(profile.id));

  const filtered = realProfiles
    .filter((profile) => {
      const meta = metadataById.get(profile.id);
      if (!meta) return false;
      if (!matchesText(query, meta.name, profile.bio, meta.officeTitle, meta.jurisdictionName, meta.partyText)) return false;
      if (params.office && meta.officeGroup !== params.office) return false;
      if (params.jurisdiction && meta.jurisdictionName !== params.jurisdiction) return false;
      if (params.party && (meta.partyText ?? "No party listed") !== params.party) return false;
      if (params.year && meta.electionYear !== params.year) return false;
      if (params.incumbent === "incumbent" && !meta.isIncumbent) return false;
      if (params.incumbent === "challenger" && meta.isIncumbent) return false;
      if (hasBio !== null && meta.hasBio !== hasBio) return false;
      if (hasFinance !== null && meta.hasFinance !== hasFinance) return false;
      if (hasIssues !== null && meta.hasIssues !== hasIssues) return false;
      if (hasNews !== null && meta.hasNews !== hasNews) return false;
      if (params.completeness && meta.completenessLabel !== params.completeness) return false;
      return true;
    })
    .sort((left, right) => {
      const leftMeta = metadataById.get(left.id)!;
      const rightMeta = metadataById.get(right.id)!;
      switch (sort) {
        case "name":
          return leftMeta.name.localeCompare(rightMeta.name);
        case "office":
          return leftMeta.officeGroup.localeCompare(rightMeta.officeGroup) || leftMeta.name.localeCompare(rightMeta.name);
        case "jurisdiction":
          return leftMeta.jurisdictionName.localeCompare(rightMeta.jurisdictionName) || leftMeta.name.localeCompare(rightMeta.name);
        case "data":
          return rightMeta.completenessScore - leftMeta.completenessScore || leftMeta.name.localeCompare(rightMeta.name);
        case "updated":
        default:
          return rightMeta.updatedAt.getTime() - leftMeta.updatedAt.getTime();
      }
    });

  const queryState = {
    q: query || undefined,
    sort,
    office: params.office,
    jurisdiction: params.jurisdiction,
    party: params.party,
    year: params.year,
    incumbent: params.incumbent,
    hasBio: params.hasBio,
    hasFinance: params.hasFinance,
    hasIssues: params.hasIssues,
    hasNews: params.hasNews,
    completeness: params.completeness,
  };
  const returnPath = buildQuery(queryState, {});
  const officeOptions = optionCounts(metadataRows, (row) => row.officeGroup);
  const jurisdictionOptions = optionCounts(metadataRows, (row) => row.jurisdictionName);
  const partyOptions = optionCounts(metadataRows, (row) => row.partyText ?? "No party listed");
  const yearOptions = optionCounts(metadataRows, (row) => row.electionYear);

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Candidates"
        title="Candidate directory"
        description="Filter real candidate records by race, jurisdiction, party, election year, source coverage, and data completeness."
        actions={
          <Link href="/explore" className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
            Back to Explore
          </Link>
        }
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Filters</p>
            <p className="mt-2 text-sm text-slate-600">Options are populated from stored candidate records only.</p>
          </div>
          <span className="rounded-full bg-civic-50 px-4 py-2 text-sm font-semibold text-civic-700">
            {filtered.length} of {realProfiles.length} candidates
          </span>
        </div>

        <PreserveScrollQueryForm action="/candidates" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Search
            <input name="q" defaultValue={query} placeholder="Name, office, jurisdiction" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-civic-500" />
          </label>
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Office / race
            <select name="office" defaultValue={params.office ?? ""} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-slate-700">
              <option value="">All offices</option>
              {officeOptions.map(([value, count]) => <option key={value} value={value}>{value} ({count})</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Jurisdiction
            <select name="jurisdiction" defaultValue={params.jurisdiction ?? ""} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-slate-700">
              <option value="">All jurisdictions</option>
              {jurisdictionOptions.map(([value, count]) => <option key={value} value={value}>{value} ({count})</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Party
            <select name="party" defaultValue={params.party ?? ""} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-slate-700">
              <option value="">All parties</option>
              {partyOptions.map(([value, count]) => <option key={value} value={value}>{value} ({count})</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Election year
            <select name="year" defaultValue={params.year ?? ""} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-slate-700">
              <option value="">All years</option>
              {yearOptions.map(([value, count]) => <option key={value} value={value}>{value} ({count})</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Incumbent / challenger
            <select name="incumbent" defaultValue={params.incumbent ?? ""} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-slate-700">
              <option value="">All candidates</option>
              <option value="incumbent">Incumbents</option>
              <option value="challenger">Challengers</option>
            </select>
          </label>
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Data completeness
            <select name="completeness" defaultValue={params.completeness ?? ""} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-slate-700">
              <option value="">Any coverage</option>
              <option value="complete">Complete</option>
              <option value="substantial">Substantial</option>
              <option value="needs_sources">Needs sources</option>
            </select>
          </label>
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Sort
            <select name="sort" defaultValue={sort} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-slate-700">
              <option value="updated">Recently updated</option>
              <option value="name">Name</option>
              <option value="office">Office</option>
              <option value="jurisdiction">Jurisdiction</option>
              <option value="data">Data completeness</option>
            </select>
          </label>

          {[
            ["hasBio", "Has bio"],
            ["hasFinance", "Has campaign finance"],
            ["hasIssues", "Has issue positions"],
            ["hasNews", "Has news mentions"],
          ].map(([name, label]) => (
            <label key={name} className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {label}
              <select name={name} defaultValue={queryState[name as keyof typeof queryState] ?? ""} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal text-slate-700">
                <option value="">Either</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          ))}

          <div className="flex flex-wrap items-end gap-3 md:col-span-2 xl:col-span-4">
            <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Apply filters
            </button>
            <Link href="/candidates" scroll={false} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
              Clear filters
            </Link>
          </div>
        </PreserveScrollQueryForm>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Results</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Matching candidates</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            {filtered.length} candidate{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {filtered.length ? (
            filtered.map((candidate) => <CandidateDirectoryCard key={candidate.id} candidate={candidate} returnPath={returnPath} />)
          ) : (
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">
              No candidates match these filters.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

