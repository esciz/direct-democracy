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

function PersonCard({ item, type }: { item: RepresentativeLookupItem; type: "official" | "candidate" }) {
  return (
    <article className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Real data</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">{type === "official" ? "Official" : "Candidate"}</span>
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
  const hasData = group.officials.length || group.candidates.length || group.elections.length || group.ballotItems.length;

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{group.label}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{group.label}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{group.description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
          {group.officials.length + group.candidates.length} people
        </span>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {group.officials.map((official) => <PersonCard key={`official-${official.id}`} item={official} type="official" />)}
        {group.candidates.map((candidate) => <PersonCard key={`candidate-${candidate.id}`} item={candidate} type="candidate" />)}
        {!hasData ? (
          <div className="rounded-3xl bg-slate-50 p-5 text-sm leading-6 text-slate-600 xl:col-span-2">
            District match pending — source data not imported yet.
          </div>
        ) : null}
      </div>

      {group.elections.length || group.ballotItems.length ? (
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {group.elections.map((election) => (
            <Link key={election.id} href={election.href} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-civic-400">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-civic-700">Election</p>
              <h3 className="mt-2 text-base font-semibold text-ink">{election.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{election.officeTitle} · {new Date(election.electionDate).toLocaleDateString()}</p>
            </Link>
          ))}
          {group.ballotItems.map((item) => (
            <Link key={item.id} href={item.href} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-civic-400">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-civic-700">Ballot item</p>
              <h3 className="mt-2 text-base font-semibold text-ink">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{item.jurisdictionName}</p>
            </Link>
          ))}
        </div>
      ) : null}

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
        title="Who represents me?"
        description="District-aware beta lookup for Nevada, Washoe, Reno, Sparks, Carson City, courts, and school districts. District-specific offices appear only when stored assignments or boundary data can support the match."
        meta={
          <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
            Real-data matching only
          </span>
        }
        actions={
          <Link href="/officials?communityId=nevada" className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">
            Open officials directory
          </Link>
        }
      />

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Address or community</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Find applicable districts</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Enter a local community, campus, or stored coordinate pair. External geocoding is not run during page render.
            </p>
          </div>
          <form action="/who-represents-me" className="flex w-full flex-wrap gap-3 lg:w-[34rem]">
            <input
              type="search"
              name="address"
              defaultValue={locationInput}
              placeholder="Reno, Washoe County, UNR, Carson City, or lat,lng"
              className="min-w-[15rem] flex-1 rounded-full border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
            />
            <button type="submit" className="dd-button-primary rounded-full px-5 py-3 text-sm font-semibold">
              Match
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
            Filter voting by matched districts
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
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Source adapters</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Boundary and source import status</h2>
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
