import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";
import { getRepresentativeLookup, type RepresentativeLookupGroup, type RepresentativeLookupItem } from "@/lib/district-matching/lookup";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getOnboardingDraft } from "@/lib/server/onboarding";

type WhoRepresentsMePageProps = {
  searchParams?: Promise<{
    address?: string;
    community?: string;
  }>;
};

function confidenceLabel(score: number) {
  if (score <= 0) return "Pending";
  return `${Math.round(score * 100)}% confidence`;
}

const GROUP_GUIDANCE: Record<
  RepresentativeLookupGroup["key"],
  {
    plainEnglish: string;
    hierarchy: string[];
  }
> = {
  federal: {
    plainEnglish: "Federal officials handle national laws, Congress, federal agencies, and issues that cross state lines. Nevada has two U.S. senators statewide, plus one U.S. House member for your congressional district.",
    hierarchy: ["U.S. senators", "U.S. House district representative"],
  },
  state: {
    plainEnglish: "State officials handle Nevada laws, statewide agencies, courts, elections, budgets, and statewide policy. State legislators represent smaller districts inside Nevada.",
    hierarchy: ["Governor", "Lieutenant Governor", "Attorney General", "Secretary of State", "Treasurer / Controller", "State Senator", "Assemblymember"],
  },
  county: {
    plainEnglish: "County or county-equivalent officials handle local elections, records, prosecution, law enforcement, taxes, and public services. Carson City is both a city and county-equivalent government.",
    hierarchy: ["Commission / board authority", "Sheriff", "District Attorney", "Clerk-Recorder", "Assessor", "Treasurer"],
  },
  city: {
    plainEnglish: "City officials handle local ordinances, land use, roads, public safety policy, parks, utilities, permits, and city budgets. The mayor is citywide; ward supervisors represent parts of the city.",
    hierarchy: ["Mayor", "Ward supervisors / councilmembers"],
  },
  school: {
    plainEnglish: "School board trustees set district policy, approve budgets, hire and evaluate the superintendent, and represent families in trustee districts.",
    hierarchy: ["Board president", "Vice president", "Clerk", "Trustees by district"],
  },
  courts: {
    plainEnglish: "Judges and justice court officials handle court cases, hearings, warrants, traffic/criminal matters, small claims, and other legal proceedings within the court’s jurisdiction.",
    hierarchy: ["Judicial district", "Justice / municipal court departments"],
  },
};

function officialPriority(groupKey: RepresentativeLookupGroup["key"], item: RepresentativeLookupItem) {
  const text = `${item.roleLabel} ${item.districtName ?? ""}`.toLowerCase();

  if (groupKey === "federal") {
    if (text.includes("senator")) return 10;
    if (text.includes("representative")) return 20;
  }

  if (groupKey === "state") {
    if (text.includes("governor") && !text.includes("lieutenant")) return 10;
    if (text.includes("lieutenant governor")) return 20;
    if (text.includes("attorney general")) return 30;
    if (text.includes("secretary of state")) return 40;
    if (text.includes("treasurer")) return 50;
    if (text.includes("controller")) return 60;
    if (text.includes("senate") || text.includes("senator")) return 70;
    if (text.includes("assembly")) return 80;
  }

  if (groupKey === "county") {
    if (text.includes("commission") || text.includes("supervisor")) return 10;
    if (text.includes("sheriff")) return 20;
    if (text.includes("district attorney")) return 30;
    if (text.includes("clerk") || text.includes("recorder")) return 40;
    if (text.includes("assessor")) return 50;
    if (text.includes("treasurer")) return 60;
  }

  if (groupKey === "city") {
    if (text.includes("mayor")) return 10;
    if (text.includes("supervisor") || text.includes("council")) return 20;
  }

  if (groupKey === "school") {
    if (text.includes("president")) return 10;
    if (text.includes("vice president")) return 20;
    if (text.includes("clerk")) return 30;
    const district = text.match(/district\s+(\d+)/)?.[1];
    return district ? 40 + Number(district) : 60;
  }

  if (groupKey === "courts") {
    if (text.includes("department i") && !text.includes("department ii")) return 10;
    if (text.includes("department ii")) return 20;
    if (text.includes("judge") || text.includes("justice")) return 30;
  }

  return 100;
}

function hierarchyContext(groupKey: RepresentativeLookupGroup["key"], item: RepresentativeLookupItem) {
  const text = `${item.roleLabel} ${item.districtName ?? ""}`.toLowerCase();

  if (groupKey === "federal") {
    return text.includes("senator")
      ? "Represents all Nevada in the U.S. Senate."
      : "Represents your congressional district in the U.S. House.";
  }

  if (groupKey === "state") {
    if (text.includes("governor") && !text.includes("lieutenant")) return "Top statewide executive; leads Nevada state government.";
    if (text.includes("lieutenant governor")) return "Statewide executive role; succeeds the governor if needed and chairs/serves on state bodies.";
    if (text.includes("attorney general")) return "Statewide legal officer for Nevada.";
    if (text.includes("secretary of state")) return "Runs statewide elections, business filings, and state records functions.";
    if (text.includes("treasurer") || text.includes("controller")) return "Handles statewide public finance, accounting, and fiscal oversight.";
    if (text.includes("senate") || text.includes("senator")) return "Your upper-chamber state legislator.";
    if (text.includes("assembly")) return "Your lower-chamber state legislator.";
  }

  if (groupKey === "county") {
    if (text.includes("sheriff")) return "County law-enforcement office.";
    if (text.includes("district attorney")) return "County prosecutor and legal office.";
    if (text.includes("clerk") || text.includes("recorder")) return "Local records, elections, and recording office.";
    if (text.includes("assessor")) return "Property assessment office.";
    if (text.includes("treasurer")) return "Local tax and treasury office.";
  }

  if (groupKey === "city") {
    return text.includes("mayor")
      ? "Citywide elected local leader."
      : "Local ward representative on the city/county governing board.";
  }

  if (groupKey === "school") {
    if (text.includes("president")) return "Leads school board meetings and board process.";
    if (text.includes("vice president")) return "Board leadership role; supports or substitutes for the president.";
    if (text.includes("clerk")) return "Board officer role tied to board records and process.";
    return "Trustee representing a school board district.";
  }

  if (groupKey === "courts") {
    return "Local court official for cases and hearings in this court department.";
  }

  return "Current source-backed official for this level.";
}

function OfficialCard({ item, groupKey, positionIndex }: { item: RepresentativeLookupItem; groupKey: RepresentativeLookupGroup["key"]; positionIndex: number }) {
  return (
    <article className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Source-linked roster</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">Current official</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">Hierarchy {positionIndex}</span>
        <span className="rounded-full bg-civic-50 px-2.5 py-1 text-[11px] font-semibold text-civic-700">{confidenceLabel(item.confidenceScore)}</span>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-ink">{item.name}</h3>
      <p className="mt-1 text-sm leading-5 text-slate-600">{item.roleLabel}</p>
      <p className="mt-1 text-xs text-slate-500">
        {item.jurisdictionName}
        {item.districtName ? ` · ${item.districtName}` : " · At-large / jurisdiction-wide"}
        {item.partyText ? ` · ${item.partyText}` : ""}
      </p>
      <p className="mt-3 rounded-2xl bg-civic-50 px-3 py-2 text-xs font-semibold leading-5 text-civic-800">{hierarchyContext(groupKey, item)}</p>
      <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{item.matchNote}</p>
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
  const guidance = GROUP_GUIDANCE[group.key];
  const orderedOfficials = [...group.officials].sort((left, right) => {
    const priorityDiff = officialPriority(group.key, left) - officialPriority(group.key, right);
    return priorityDiff || left.roleLabel.localeCompare(right.roleLabel) || left.name.localeCompare(right.name);
  });

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

      <div className="mt-5 rounded-[1.25rem] border border-civic-100 bg-civic-50/70 p-4">
        <p className="text-sm font-semibold text-civic-900">How this level fits</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{guidance.plainEnglish}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {guidance.hierarchy.map((step, index) => (
            <span key={`${group.key}-hierarchy-${step}`} className="rounded-full border border-civic-100 bg-white px-3 py-1 text-xs font-semibold text-civic-800">
              {index + 1}. {step}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {orderedOfficials.map((official, index) => <OfficialCard key={`official-${official.id}`} item={official} groupKey={group.key} positionIndex={index + 1} />)}
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
  const [user, onboardingDraft] = await Promise.all([getCurrentUser(), getOnboardingDraft()]);
  const explicitLocationInput = params?.address?.trim() || params?.community?.trim() || "";
  const registeredAddressApplies =
    !explicitLocationInput &&
    onboardingDraft?.streetAddress &&
    (!onboardingDraft.accountEmail || onboardingDraft.accountEmail.toLowerCase() === user.email.toLowerCase());
  const locationInput = explicitLocationInput || (registeredAddressApplies ? `${onboardingDraft.streetAddress}, ${onboardingDraft.jurisdictionName || user.jurisdictionName}` : "");
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
            {registeredAddressApplies ? (
              <p className="mt-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                Using your registered address on file for district routing.
              </p>
            ) : null}
          </div>
          <form action="/who-represents-me" className="flex w-full flex-wrap gap-3 lg:w-[34rem]">
            <input
              type="search"
              name="address"
              defaultValue={explicitLocationInput}
              placeholder="Carson City, Reno, Washoe County, or your address"
              className="min-w-[15rem] flex-1 rounded-full border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
            />
            <button type="submit" className="dd-button-primary rounded-full px-5 py-3 text-sm font-semibold">
              Find representatives
            </button>
          </form>
        </div>
      </section>

      {lookup.groups.map((group) => <GroupSection key={group.key} group={group} />)}

      <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Coverage limit</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Confirm district-specific offices</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Exact district boundaries are not available for every Nevada address yet. Statewide and jurisdiction-wide officials can be shown with source links, but district-specific legislators, trustees, commissioners, judges, and ward representatives may be missing or approximate.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Open the source on an official card before relying on the result. The lookup will become address-precise as official GIS boundary layers are imported and reviewed.
        </p>
      </section>
    </div>
  );
}
