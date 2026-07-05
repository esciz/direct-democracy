import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";
import { getRepresentativeLookup, type DistrictAssignmentSummary, type RepresentativeLookupGroup, type RepresentativeLookupItem } from "@/lib/district-matching/lookup";
import { getCurrentUser } from "@/lib/server/auth-session";

type WhoRepresentsMePageProps = {
  searchParams?: Promise<{
    address?: string;
    community?: string;
  }>;
};

function formatDate(value: string | null) {
  if (!value) return "Last updated pending";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function confidenceLabel(score: number) {
  if (score <= 0) return "Pending";
  return `${Math.round(score * 100)}% confidence`;
}

function AssignmentCard({ assignment }: { assignment: DistrictAssignmentSummary }) {
  const pending = assignment.status === "pending";

  return (
    <article className={`rounded-[1.35rem] border p-4 ${pending ? "border-amber-300/20 bg-amber-500/10" : "border-white/10 bg-white/[0.04]"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${pending ? "bg-amber-300/10 text-amber-100" : "bg-emerald-300/10 text-emerald-100"}`}>
          {pending ? "Pending" : "Matched"}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
          {confidenceLabel(assignment.confidenceScore)}
        </span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-50">{assignment.label}</h3>
      <p className="mt-1 text-sm text-slate-400">
        {assignment.jurisdictionName}
        {assignment.districtName ? ` · ${assignment.districtName}` : ""}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-300">{assignment.matchMethod}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <a href={assignment.sourceUrl} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100">
          {assignment.sourceName}
        </a>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-300">{formatDate(assignment.lastUpdated)}</span>
      </div>
    </article>
  );
}

function OfficialCard({ item }: { item: RepresentativeLookupItem }) {
  return (
    <article className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Real data</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">Current official</span>
        <span className="rounded-full bg-civic-50 px-2.5 py-1 text-[11px] font-semibold text-civic-700">{confidenceLabel(item.confidenceScore)}</span>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-ink">{item.name}</h3>
      <p className="mt-1 text-sm leading-5 text-slate-600">{item.roleLabel}</p>
      <p className="mt-1 text-xs text-slate-500">
        {item.jurisdictionName}
        {item.districtName ? ` · ${item.districtName}` : " · At-large / jurisdiction-wide"}
        {item.partyText ? ` · ${item.partyText}` : ""}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={item.href} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
          Open profile
        </Link>
        {item.sourceUrl ? (
          <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
            Source
          </a>
        ) : null}
      </div>
    </article>
  );
}

function GroupSection({ group }: { group: RepresentativeLookupGroup }) {
  const officialCount = group.officials.length;
  const hasOfficials = officialCount > 0;

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{group.label}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{group.label}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{group.description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
          {officialCount} official{officialCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {group.officials.map((official) => <OfficialCard key={`official-${official.id}`} item={official} />)}
        {!hasOfficials ? (
          <div className="rounded-3xl bg-slate-50 p-5 text-sm leading-6 text-slate-600 xl:col-span-2">
            No current officials are imported for this level yet. Candidate records and ballot items are intentionally excluded from this representative lookup.
          </div>
        ) : null}
      </div>

      {group.missing.length ? (
        <div className="mt-6 grid gap-2">
          {group.missing.map((message, index) => (
            <div key={`${group.key}-missing-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              {message}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default async function WhoRepresentsMePage({ searchParams }: WhoRepresentsMePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const user = await getCurrentUser();
  const locationInput = params?.address?.trim() || params?.community?.trim() || "";
  const lookup = await getRepresentativeLookup({ user, locationInput });

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Who Represents Me"
        title="Your current representatives"
        description="Find current officeholders for a Nevada community or address. This page intentionally excludes candidates, ballot questions, and campaign records so the answer stays focused on who represents you right now."
        meta={
          <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
            Officials only
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/officials?communityId=nevada" className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">
              Open officials directory
            </Link>
            <Link href="/elections" className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30">
              Candidates and elections
            </Link>
          </div>
        }
      />

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Representative lookup</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Search by community or address</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Start with a Nevada city, county, or address. When exact district boundaries are limited, we show the highest-confidence current officials and explain what is still missing.
            </p>
          </div>
          <form action="/who-represents-me" className="flex w-full flex-wrap gap-3 lg:w-[34rem]">
            <input
              type="search"
              name="address"
              defaultValue={locationInput}
              placeholder="Carson City, Reno, Washoe County, or your address"
              className="min-w-[15rem] flex-1 rounded-full border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
            />
            <button type="submit" className="dd-button-primary rounded-full px-5 py-3 text-sm font-semibold">
              Find representatives
            </button>
          </form>
        </div>
      </section>

      <section id="district-summary" className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">District summary</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{lookup.normalizedLocationLabel}</h2>
            <p className="mt-2 text-sm text-slate-400">Input: {lookup.inputLabel}</p>
          </div>
          <Link href={`/voting?districtScope=matched`} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30">
            See related votes
          </Link>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {[...lookup.assignments, ...lookup.pendingAssignments].map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} />
          ))}
        </div>
      </section>

      {lookup.groups.map((group) => <GroupSection key={group.key} group={group} />)}

      <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Coverage notes</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">How this lookup decides what to show</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {lookup.adapterStubs.map((adapter) => (
            <article key={adapter.key} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                  {adapter.boundarySupport === "ready" ? "Boundary ready" : "Adapter stub"}
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-50">{adapter.label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{adapter.notes}</p>
              <a href={adapter.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-cyan-200 hover:text-cyan-100">
                {adapter.sourceName}
              </a>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
