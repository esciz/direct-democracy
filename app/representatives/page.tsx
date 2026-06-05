import Link from "next/link";

import { CivicAvatar } from "@/components/domain/civic-avatar";
import { PageIntro } from "@/components/ui/page-intro";
import { getPublicOfficials, type PublicOfficialRow } from "@/lib/civic-data/public";

type RepresentativesPageProps = {
  searchParams?: Promise<{
    community?: string;
  }>;
};

type RepresentativeGroup = {
  key: string;
  label: string;
  officials: PublicOfficialRow[];
};

const COMMUNITY_OPTIONS = [
  { id: "nevada", label: "Nevada" },
  { id: "reno", label: "Reno" },
  { id: "washoe-county", label: "Washoe County" },
  { id: "carson-city", label: "Carson City" },
  { id: "campus", label: "UNR / ASUN" },
];

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function isLegislator(official: PublicOfficialRow) {
  const office = normalize(official.office.title);
  const district = normalize(official.district?.name);
  return office.includes("senator") || office.includes("assembly") || office.includes("legislature") || district.includes("senate") || district.includes("assembly");
}

function groupKeyForOfficial(official: PublicOfficialRow) {
  const slug = official.jurisdiction.slug;
  const level = official.office.level;
  const office = normalize(official.office.title);

  if (slug === "united-states" || level === "FEDERAL" || office.includes("u.s.") || office.includes("united states")) return "federal";
  if (isLegislator(official)) return "legislature";
  if (slug === "washoe-county" || level === "COUNTY") return "county";
  if (slug === "reno" || slug === "carson-city" || level === "CITY") return "city";
  if (slug === "unr" || slug === "asun" || level === "CAMPUS") return "campus";
  return "statewide";
}

function communityAllowsOfficial(community: string, official: PublicOfficialRow) {
  const slug = official.jurisdiction.slug;
  const groupKey = groupKeyForOfficial(official);

  if (community === "nevada") return ["federal", "statewide", "legislature"].includes(groupKey);
  if (community === "reno") return ["federal", "statewide", "legislature"].includes(groupKey) || slug === "reno" || slug === "washoe-county";
  if (community === "washoe-county") return ["federal", "statewide", "legislature"].includes(groupKey) || slug === "washoe-county";
  if (community === "carson-city") return ["federal", "statewide", "legislature"].includes(groupKey) || slug === "carson-city";
  if (community === "campus") return ["federal", "statewide", "legislature"].includes(groupKey) || slug === "unr" || slug === "asun";
  return ["federal", "statewide", "legislature"].includes(groupKey);
}

function buildGroups(officials: PublicOfficialRow[], community: string): RepresentativeGroup[] {
  const visibleOfficials = officials.filter((official) => communityAllowsOfficial(community, official));
  const groupDefinitions = [
    { key: "federal", label: "Federal" },
    { key: "statewide", label: "Statewide Nevada" },
    { key: "legislature", label: "Nevada Legislature" },
    { key: "county", label: "County" },
    { key: "city", label: "City" },
    { key: "campus", label: "Campus" },
  ];

  return groupDefinitions.map((group) => ({
    ...group,
    officials: visibleOfficials
      .filter((official) => groupKeyForOfficial(official) === group.key)
      .sort((left, right) => left.office.title.localeCompare(right.office.title) || left.fullName.localeCompare(right.fullName)),
  }));
}

function contactHref(type: "email" | "phone" | "website", value: string) {
  if (type === "email") return `mailto:${value}`;
  if (type === "phone") return `tel:${value.replace(/[^\d+]/g, "")}`;
  return value;
}

function RepresentativeCard({ official }: { official: PublicOfficialRow }) {
  const contacts = [
    official.email ? { label: "Email", href: contactHref("email", official.email) } : null,
    official.phone ? { label: "Call", href: contactHref("phone", official.phone) } : null,
    official.websiteUrl ? { label: "Website", href: contactHref("website", official.websiteUrl) } : null,
  ].filter((contact): contact is { label: string; href: string } => Boolean(contact));

  return (
    <article className="rounded-[1.4rem] border border-white/70 bg-white/90 p-4 shadow-card backdrop-blur">
      <div className="flex items-start gap-3">
        <CivicAvatar name={official.fullName} imageUrl={official.photoUrl} entityType="official" size="sm" verified />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-ink">{official.fullName}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-600">{official.office.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {official.jurisdiction.name}
            {official.district ? ` · ${official.district.name}` : ""}
            {official.partyText ? ` · ${official.partyText}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Imported Nevada beta data</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
          Source: {official.source?.name ?? "Imported source"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/officials/${official.id}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          Profile
        </Link>
        {contacts.map((contact) => (
          <a
            key={contact.label}
            href={contact.href}
            target={contact.label === "Website" ? "_blank" : undefined}
            rel={contact.label === "Website" ? "noreferrer" : undefined}
            className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            {contact.label}
          </a>
        ))}
      </div>
    </article>
  );
}

export default async function RepresentativesPage({ searchParams }: RepresentativesPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const selectedCommunity = COMMUNITY_OPTIONS.some((option) => option.id === params?.community) ? params!.community! : "nevada";
  const selectedLabel = COMMUNITY_OPTIONS.find((option) => option.id === selectedCommunity)?.label ?? "Nevada";
  const officials = await getPublicOfficials().catch((error) => {
    console.warn("[representatives] failed to load imported officials", error);
    return [] as PublicOfficialRow[];
  });
  const groups = buildGroups(officials, selectedCommunity);
  const visibleCount = groups.reduce((total, group) => total + group.officials.length, 0);

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Who Represents Me"
        title="Who represents me?"
        description="Beta lookup for Nevada communities using imported officials. Address-level district matching will come later."
        meta={
          <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
            Imported Nevada beta data
          </span>
        }
        actions={
          <Link href="/officials?communityId=nevada" className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">
            Open officials directory
          </Link>
        }
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Preset community</p>
            <p className="mt-2 text-sm text-slate-600">{visibleCount} imported officials shown for {selectedLabel}.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {COMMUNITY_OPTIONS.map((option) => (
              <Link
                key={option.id}
                href={`/representatives?community=${option.id}`}
                className={
                  option.id === selectedCommunity
                    ? "rounded-full bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white"
                    : "rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                }
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.key} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{group.label}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{group.label} representatives</h2>
            </div>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-sm font-semibold text-civic-700">
              {group.officials.length} official{group.officials.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {group.officials.length ? (
              group.officials.map((official) => <RepresentativeCard key={official.id} official={official} />)
            ) : (
              <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">
                No imported officials are currently matched to this category for {selectedLabel}.
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
