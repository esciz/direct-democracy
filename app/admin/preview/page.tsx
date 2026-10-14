import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CivicEntityType,
  CivicRecordReviewStatus,
  DistrictType,
  Prisma,
  ProfileEnrichmentReviewStatus,
  ProfileEnrichmentStatus,
  ProfileEnrichmentTargetType,
} from "@prisma/client";

import { PageIntro } from "@/components/ui/page-intro";
import { clearAdminPreviewModeAction, setAdminPreviewModeAction } from "@/lib/admin-preview/actions";
import {
  DEFAULT_PREVIEW_CONTEXT,
  PREVIEW_DATA_STATES,
  PREVIEW_ROLES,
  buildPreviewQuery,
  getActivePreviewContext,
  getPreviewDataStateLabel,
  getPreviewRoleLabel,
  isAdminPreviewEnabled,
  type AdminPreviewContext,
  type PreviewDataState,
} from "@/lib/admin-preview/context";
import { prisma } from "@/lib/prisma";
import { getRawCurrentSessionUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

const DISTRICT_PREVIEW_TYPES = [
  DistrictType.SCHOOL_DISTRICT,
  DistrictType.SCHOOL_BOARD,
  DistrictType.JUDICIAL_DISTRICT,
  DistrictType.MUNICIPAL_COURT,
  DistrictType.JUSTICE_COURT,
];

type PreviewPageProps = {
  searchParams?: Promise<{
    previewRole?: string;
    previewJurisdiction?: string;
    previewDataState?: string;
  }>;
};

function getContextFromParams(params: Awaited<NonNullable<PreviewPageProps["searchParams"]>> | undefined, storedContext: AdminPreviewContext | null): AdminPreviewContext {
  const role = PREVIEW_ROLES.some((entry) => entry.value === params?.previewRole) ? (params?.previewRole as AdminPreviewContext["role"]) : storedContext?.role;
  const dataState = PREVIEW_DATA_STATES.some((entry) => entry.value === params?.previewDataState)
    ? (params?.previewDataState as AdminPreviewContext["dataState"])
    : storedContext?.dataState;

  return {
    role: role ?? DEFAULT_PREVIEW_CONTEXT.role,
    jurisdiction: params?.previewJurisdiction ?? storedContext?.jurisdiction ?? DEFAULT_PREVIEW_CONTEXT.jurisdiction,
    dataState: dataState ?? DEFAULT_PREVIEW_CONTEXT.dataState,
  };
}

function formatDate(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value) : "Not imported";
}

function formatSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function getPreviewJurisdictions() {
  const [coreJurisdictions, districtJurisdictions] = await Promise.all([
    prisma.jurisdiction.findMany({
      where: { slug: { in: ["reno", "washoe-county", "nevada"] } },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, type: true },
    }),
    prisma.jurisdiction.findMany({
      where: {
        districts: {
          some: {
            districtType: { in: DISTRICT_PREVIEW_TYPES },
          },
        },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, type: true },
    }),
  ]);
  const bySlug = new Map([...coreJurisdictions, ...districtJurisdictions].map((jurisdiction) => [jurisdiction.slug, jurisdiction]));

  return [...bySlug.values()];
}

async function getPreviewDistricts() {
  return prisma.district.findMany({
    where: {
      districtType: { in: DISTRICT_PREVIEW_TYPES },
    },
    include: {
      jurisdiction: { select: { name: true, slug: true } },
      source: { select: { name: true, url: true } },
    },
    orderBy: [{ jurisdiction: { name: "asc" } }, { name: "asc" }],
    take: 60,
  });
}

async function getEntityStateIds(entityType: CivicEntityType, targetType: ProfileEnrichmentTargetType) {
  const [enrichments, approvedReviews, verifiedReviews, conflictReviews, conflictVersions] = await Promise.all([
    prisma.profileWebsiteEnrichment.findMany({
      where: { targetType },
      select: { targetId: true, enrichmentStatus: true, reviewStatus: true },
    }),
    prisma.civicEntityReview.findMany({
      where: { entityType, reviewStatus: CivicRecordReviewStatus.approved },
      select: { entityId: true },
    }),
    prisma.civicEntityReview.findMany({
      where: {
        entityType,
        OR: [{ reviewStatus: CivicRecordReviewStatus.verified }, { verificationStatus: CivicRecordReviewStatus.verified }],
      },
      select: { entityId: true },
    }),
    prisma.civicEntityReview.findMany({
      where: { entityType, reviewStatus: CivicRecordReviewStatus.pending_review },
      select: { entityId: true },
    }),
    prisma.importedRecordVersion.findMany({
      where: { entityType, reviewStatus: CivicRecordReviewStatus.pending_review },
      select: { entityId: true },
    }),
  ]);

  return {
    enrichedIds: enrichments.filter((entry) => entry.enrichmentStatus !== ProfileEnrichmentStatus.NOT_STARTED && entry.enrichmentStatus !== ProfileEnrichmentStatus.ERROR).map((entry) => entry.targetId),
    pendingEnrichmentIds: enrichments
      .filter((entry) => entry.reviewStatus === ProfileEnrichmentReviewStatus.PENDING_REVIEW || entry.reviewStatus === ProfileEnrichmentReviewStatus.NEEDS_MORE_SOURCES)
      .map((entry) => entry.targetId),
    approvedIds: [...approvedReviews.map((entry) => entry.entityId), ...enrichments.filter((entry) => entry.reviewStatus === ProfileEnrichmentReviewStatus.APPROVED).map((entry) => entry.targetId)],
    verifiedIds: [...verifiedReviews.map((entry) => entry.entityId), ...enrichments.filter((entry) => entry.reviewStatus === ProfileEnrichmentReviewStatus.VERIFIED).map((entry) => entry.targetId)],
    conflictIds: [...conflictReviews.map((entry) => entry.entityId), ...conflictVersions.map((entry) => entry.entityId)],
  };
}

function addCandidateDataState(where: Prisma.CandidateWhereInput, dataState: PreviewDataState, ids: Awaited<ReturnType<typeof getEntityStateIds>>) {
  if (dataState === "enrichment_pending") where.id = { notIn: ids.enrichedIds };
  if (dataState === "enriched_pending_review") where.id = { in: ids.pendingEnrichmentIds };
  if (dataState === "approved") where.id = { in: ids.approvedIds };
  if (dataState === "verified") where.id = { in: ids.verifiedIds };
  if (dataState === "conflicting_source_data") where.id = { in: ids.conflictIds };
  if (dataState === "incomplete_missing_data") {
    where.OR = [{ websiteUrl: null }, { photoUrl: null }, { partyText: null }, { sourceUrl: null }, { campaignStatement: null }];
  }
}

function addOfficialDataState(where: Prisma.OfficialWhereInput, dataState: PreviewDataState, ids: Awaited<ReturnType<typeof getEntityStateIds>>) {
  if (dataState === "enrichment_pending") where.id = { notIn: ids.enrichedIds };
  if (dataState === "enriched_pending_review") where.id = { in: ids.pendingEnrichmentIds };
  if (dataState === "approved") where.id = { in: ids.approvedIds };
  if (dataState === "verified") where.id = { in: ids.verifiedIds };
  if (dataState === "conflicting_source_data") where.id = { in: ids.conflictIds };
  if (dataState === "incomplete_missing_data") {
    where.OR = [{ websiteUrl: null }, { photoUrl: null }, { email: null }, { phone: null }];
  }
}

async function getPreviewTargets(context: AdminPreviewContext) {
  const [candidateStateIds, officialStateIds] = await Promise.all([
    getEntityStateIds(CivicEntityType.CANDIDATE, ProfileEnrichmentTargetType.CANDIDATE),
    getEntityStateIds(CivicEntityType.OFFICIAL, ProfileEnrichmentTargetType.OFFICIAL),
  ]);

  const candidateWhere: Prisma.CandidateWhereInput = {
    sourceId: { not: null },
    jurisdiction: { slug: context.jurisdiction },
  };
  const officialWhere: Prisma.OfficialWhereInput = {
    sourceId: { not: null },
    jurisdiction: { slug: context.jurisdiction },
  };
  addCandidateDataState(candidateWhere, context.dataState, candidateStateIds);
  addOfficialDataState(officialWhere, context.dataState, officialStateIds);

  const [candidates, officials, elections] = await Promise.all([
    prisma.candidate.findMany({
      where: candidateWhere,
      include: {
        election: { select: { title: true, electionDate: true, officeTitle: true } },
        office: { select: { title: true } },
        jurisdiction: { select: { name: true, slug: true } },
        source: { select: { name: true, url: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { fullName: "asc" }],
      take: 6,
    }),
    prisma.official.findMany({
      where: officialWhere,
      include: {
        office: { select: { title: true } },
        jurisdiction: { select: { name: true, slug: true } },
        district: { select: { name: true } },
        source: { select: { name: true, url: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { fullName: "asc" }],
      take: 6,
    }),
    prisma.election.findMany({
      where: {
        sourceId: { not: null },
        jurisdiction: { slug: context.jurisdiction },
      },
      include: {
        jurisdiction: { select: { name: true, slug: true } },
        source: { select: { name: true, url: true } },
      },
      orderBy: [{ electionDate: "desc" }, { title: "asc" }],
      take: 6,
    }),
  ]);

  return { candidates, officials, elections };
}

function appendPreview(href: string, context: AdminPreviewContext) {
  return `${href}?${buildPreviewQuery(context)}`;
}

export default async function AdminPreviewPage({ searchParams }: PreviewPageProps) {
  if (!isAdminPreviewEnabled()) {
    redirect("/profile");
  }

  const user = await getRawCurrentSessionUser();

  if (user?.role !== "admin") {
    redirect("/profile");
  }

  const [params, storedContext, jurisdictions, districts] = await Promise.all([
    searchParams ? searchParams : Promise.resolve(undefined),
    getActivePreviewContext(),
    getPreviewJurisdictions(),
    getPreviewDistricts(),
  ]);
  const context = getContextFromParams(params, storedContext);
  const targets = await getPreviewTargets(context);
  const candidate = targets.candidates[0] ?? null;
  const official = targets.officials[0] ?? null;
  const election = targets.elections[0] ?? null;

  const targetLinks = [
    { label: "Voting", href: appendPreview("/voting", context), enabled: true },
    { label: "Candidates", href: appendPreview("/candidates", context), enabled: true },
    { label: "Officials", href: appendPreview("/officials", context), enabled: true },
    { label: "Candidate detail", href: candidate ? appendPreview(`/candidates/${candidate.id}`, context) : null, enabled: Boolean(candidate) },
    { label: "Official detail", href: official ? appendPreview(`/officials/${official.id}`, context) : null, enabled: Boolean(official) },
    { label: "Who Represents Me", href: appendPreview("/who-represents-me", context), enabled: true },
    { label: "Election detail", href: election ? appendPreview(`/elections/${election.id}`, context) : null, enabled: Boolean(election) },
  ];

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Preview real-data states"
        description="Preview roles, jurisdictions, and data completeness states using stored imported civic records only."
        actions={
          <form action={clearAdminPreviewModeAction}>
            <button type="submit" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Clear preview
            </button>
          </form>
        }
      />

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <form action={setAdminPreviewModeAction} className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Preview user mode</span>
            <select name="previewRole" defaultValue={context.role} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-slate-100">
              {PREVIEW_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Civic context</span>
            <select name="previewJurisdiction" defaultValue={context.jurisdiction} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-slate-100">
              {jurisdictions.map((jurisdiction) => (
                <option key={jurisdiction.id} value={jurisdiction.slug}>
                  {jurisdiction.name} - {jurisdiction.type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Data state</span>
            <select name="previewDataState" defaultValue={context.dataState} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-slate-100">
              {PREVIEW_DATA_STATES.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="dd-button-primary rounded-full px-5 py-3 text-sm font-semibold">
            Apply preview
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-5">
        <p className="text-sm font-semibold text-amber-50">
          Preview mode: {getPreviewRoleLabel(context.role)} - {formatSlug(context.jurisdiction)} - {getPreviewDataStateLabel(context.dataState)}
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">
          This changes UI permissions and visibility only. It does not create records, alter imported source data, or fall back to fake civic entities.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Target pages</h2>
          <div className="mt-4 grid gap-2">
            {targetLinks.map((link) =>
              link.href ? (
                <Link key={link.label} href={link.href} className="dd-button-secondary rounded-full px-4 py-2.5 text-center text-sm font-semibold">
                  {link.label}
                </Link>
              ) : (
                <div key={link.label} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-center text-sm text-slate-500">
                  {link.label} - no real record
                </div>
              ),
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Real candidate targets</h2>
          <div className="mt-4 space-y-3">
            {targets.candidates.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                <p className="font-semibold text-slate-50">{item.ballotName ?? item.fullName}</p>
                <p className="mt-1 text-xs text-slate-400">{item.office?.title ?? item.election.officeTitle} - {item.jurisdiction.name}</p>
                <p className="mt-1 text-xs text-cyan-200">{item.source?.name ?? "Imported source"} - updated {formatDate(item.updatedAt)}</p>
              </div>
            ))}
            {targets.candidates.length === 0 ? <p className="text-sm text-slate-400">No real imported candidates match this jurisdiction and data state.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Real official targets</h2>
          <div className="mt-4 space-y-3">
            {targets.officials.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                <p className="font-semibold text-slate-50">{item.fullName}</p>
                <p className="mt-1 text-xs text-slate-400">{item.office.title} - {item.district?.name ?? item.jurisdiction.name}</p>
                <p className="mt-1 text-xs text-cyan-200">{item.source?.name ?? "Imported source"} - updated {formatDate(item.updatedAt)}</p>
              </div>
            ))}
            {targets.officials.length === 0 ? <p className="text-sm text-slate-400">No real imported officials match this jurisdiction and data state.</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Real election targets</h2>
          <div className="mt-4 space-y-3">
            {targets.elections.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                <p className="font-semibold text-slate-50">{item.title}</p>
                <p className="mt-1 text-xs text-slate-400">{item.jurisdiction.name} - {formatDate(item.electionDate)}</p>
                <p className="mt-1 text-xs text-cyan-200">{item.source?.name ?? "Imported source"}</p>
              </div>
            ))}
            {targets.elections.length === 0 ? <p className="text-sm text-slate-400">No real imported elections match this jurisdiction yet.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Imported district contexts</h2>
          <div className="mt-4 space-y-3">
            {districts.map((district) => (
              <div key={district.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                <p className="font-semibold text-slate-50">{district.name}</p>
                <p className="mt-1 text-xs text-slate-400">{district.districtType.replaceAll("_", " ")} - {district.jurisdiction.name}</p>
                <p className="mt-1 text-xs text-cyan-200">{district.source?.name ?? "Source attribution pending"}</p>
              </div>
            ))}
            {districts.length === 0 ? <p className="text-sm text-slate-400">School, court, or judicial districts are not imported yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
