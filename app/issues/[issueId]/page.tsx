import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { IssuePositionsSection } from "@/components/domain/issue-positions-section";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { OrganizationCard } from "@/components/domain/organization-card";
import { PoliticalAdsSection } from "@/components/domain/political-ads-section";
import { ProfileImagePlaceholder } from "@/components/domain/profile-image-placeholder";
import { RoleBadge } from "@/components/domain/role-badge";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import { SourceExplorer, type SourceExplorerItem } from "@/components/domain/source-explorer";
import { SummaryBriefPanel } from "@/components/domain/summary-brief-panel";
import { PageIntro } from "@/components/ui/page-intro";
import { isGuestUserId } from "@/lib/auth/session";
import { PUBLIC_DEMO_DATA_ENABLED } from "@/lib/auth/constants";
import { getDefaultSeedUser } from "@/lib/auth/mock-users";
import { toggleTopIssueUpvote } from "@/lib/community/actions";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getAllCases } from "@/lib/cases/store";
import { getDiscoverableEventsForUser } from "@/lib/community/event-discovery";
import { getCommunityEventTypeLabel } from "@/lib/community/events";
import { getDebatesForUser } from "@/lib/debates/store";
import { getFeedPostPreviews } from "@/lib/feed/posts";
import { getIssueHubRecordByRouteParam } from "@/lib/issues/civic-hub";
import { valuesMatchIssueText } from "@/lib/issues/utils";
import { getIssueReviewRequestsForIssue } from "@/lib/issues/review-requests";
import { getIssueFrame, type IssueFrame } from "@/lib/issues/framing";
import { getIssuePositionsByIssue } from "@/lib/issue-positions/store";
import { getContentDetailHref } from "@/lib/news/links";
import { getFeedMediaPreviews } from "@/lib/media/store";
import { getAllPetitions } from "@/lib/petitions/store";
import { getPoliticalAdsForIssue } from "@/lib/political-ads/store";
import { getFeedPollPreviews } from "@/lib/polls/store";
import { getElectionSummaries } from "@/lib/server/elections-context";
import { getIssueByRouteParam, getIssueSummary, getOrganizationsForIssue, getPeopleForIssue } from "@/lib/server/issues";
import { getContentTypeTheme } from "@/lib/ui/content-type-theme";
import type { AuthUser, OrganizationSummary, PostSummary, PublicCitizenDirectorySummary, TopIssueSummary } from "@/types/domain";
import { submitIssueCitizenVoice } from "./actions";

type IssueDetailPageProps = {
  params: Promise<{
    issueId: string;
  }>;
  searchParams?: Promise<{
    filter?: string;
    issuePost?: string;
    issuePostError?: string;
  }>;
};

type IssueFilter = "all" | "posts" | "events" | "news" | "debates" | "petitions" | "cases" | "ballotMeasures";

type IssuePreviewCard = {
  id: string;
  href: string;
  label: string;
  title: string;
  subtitle: string;
  description: string;
  meta: string[];
};

type IssueSide = "support" | "oppose";

type IssueBattlegroundItem = {
  id: string;
  href: string;
  label: string;
  title: string;
  detail: string;
  meta?: string[];
};

type IssueSideData = {
  summary: string;
  contributions: IssueBattlegroundItem[];
  evidence: IssueBattlegroundItem[];
  audio: IssueAudioPreviewItem[];
  momentum: string[];
  primaryActionLabel: string;
  primaryActionHref: string;
};

type IssueAudioPreviewItem = {
  id: string;
  href: string;
  title: string;
  summary: string;
  contributor: string;
  durationLabel: string;
  formatLabel: string;
  sideLabel: string;
  audioUrl: string;
  issueTags: string[];
};

const ISSUE_VOICE_ROLES = new Set<AuthUser["role"]>(["citizen", "trustedCitizen", "verified_resident"]);

function isRealCitizenIssuePost(post: PostSummary) {
  return PUBLIC_DEMO_DATA_ENABLED || post.id.startsWith("post_created_");
}

function isRealIssueDebate(debateId: string) {
  return PUBLIC_DEMO_DATA_ENABLED || debateId.startsWith("debate_phase1_") || /^debate_\d+$/.test(debateId);
}

function canSubmitIssueVoice(user: AuthUser) {
  return !isGuestUserId(user.id) && ISSUE_VOICE_ROLES.has(user.role);
}

function getStateBucket(jurisdictionName: string) {
  const normalized = jurisdictionName.trim();
  if (!normalized) return "Unknown";
  if (normalized === "United States") return "National";
  if (normalized === "Nevada" || normalized.endsWith(", Nevada")) return "Nevada";
  const parts = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? normalized;
}

function getLocalityRank(post: PostSummary, currentUser: AuthUser) {
  if (post.jurisdictionName === currentUser.jurisdictionName) return 0;
  if (post.jurisdictionName !== "United States" && getStateBucket(post.jurisdictionName) === getStateBucket(currentUser.jurisdictionName)) return 1;
  if (post.jurisdictionName === "United States") return 3;
  return 2;
}

function sortCitizenIssuePosts(posts: PostSummary[], currentUser: AuthUser) {
  return posts.slice().sort((a, b) => {
    const locality = getLocalityRank(a, currentUser) - getLocalityRank(b, currentUser);
    if (locality !== 0) return locality;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

function mediaStoryMatchesIssue(issueText: string, story: { title: string; summary?: string; issueTags?: string[] }) {
  return valuesMatchIssueText(issueText, ...(story.issueTags ?? []), story.title, story.summary);
}

function withSectionTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 1800): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

function RelatedPeopleSection({ issueText, people }: { issueText: string; people: PublicCitizenDirectorySummary[] }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">People</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">People who rank this among their Top 3 issues</h2>
          <p className="mt-2 text-sm text-slate-600">
            These public citizen profiles list {issueText} among their visible priority issues.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {people.length} match{people.length === 1 ? "" : "es"}
        </span>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {people.length ? (
          people.map((person) => (
            <article key={person.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <ProfileImagePlaceholder name={person.name} size="sm" imageUrl={person.profileImageUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-ink">{person.name}</h3>
                    <RoleBadge role={person.role} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    @{person.username} · {person.jurisdictionName}
                  </p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{person.bio}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {person.topIssuesPreview.map((issue) => (
                      <span key={`${person.id}-${issue}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {issue}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <Link
                  href={`/citizens/${person.id}`}
                  className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                >
                  Open profile
                </Link>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">
            No public people have surfaced this issue in their visible Top 3 yet.
          </div>
        )}
      </div>
    </section>
  );
}

function RelatedOrganizationsSection({
  issueText,
  organizations,
  guestMode = false,
}: {
  issueText: string;
  organizations: OrganizationSummary[];
  guestMode?: boolean;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Organizations</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Organizations tied to this issue</h2>
          <p className="mt-2 text-sm text-slate-600">
            Civic organizations using {issueText} as one of their shared issue priorities.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {organizations.length} org{organizations.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {organizations.length ? (
          organizations.map((organization) => <OrganizationCard key={organization.id} organization={organization} guestMode={guestMode} />)
        ) : (
          <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">
            No organizations are publicly tied to this issue yet.
          </div>
        )}
      </div>
    </section>
  );
}

function normalizeFilter(value: string | undefined): IssueFilter {
  switch (value) {
    case "posts":
    case "events":
    case "news":
    case "debates":
    case "petitions":
    case "cases":
    case "ballotMeasures":
      return value;
    default:
      return "all";
  }
}

function buildIssueHref(issueId: string, filter: IssueFilter) {
  return filter === "all" ? `/issues/${issueId}` : `/issues/${issueId}?filter=${filter}`;
}

function normalizeText(value: string) {
  return value.toLowerCase();
}

function classifyIssuePosition(...values: Array<string | null | undefined>): IssueSide | "mixed" {
  const text = normalizeText(values.filter(Boolean).join(" "));
  const supportSignals = [
    "support",
    "supports",
    "expand",
    "increase",
    "invest",
    "protect",
    "approve",
    "back",
    "yes on",
    "for ",
    "fund",
    "access",
  ];
  const opposeSignals = [
    "oppose",
    "opposes",
    "against",
    "block",
    "stop",
    "reject",
    "cut",
    "lawsuit",
    "challenge",
    "concern",
    "critic",
    "no on",
  ];

  const supportScore = supportSignals.reduce((score, signal) => score + (text.includes(signal) ? 1 : 0), 0);
  const opposeScore = opposeSignals.reduce((score, signal) => score + (text.includes(signal) ? 1 : 0), 0);

  if (supportScore === opposeScore) {
    return "mixed";
  }

  return supportScore > opposeScore ? "support" : "oppose";
}

function getSideTheme(side: IssueSide) {
  return side === "support"
    ? {
        shell: "border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.92),rgba(255,255,255,0.98))]",
        badge: "bg-emerald-100 text-emerald-800",
        accent: "text-emerald-700",
      }
    : {
        shell: "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.94),rgba(255,255,255,0.98))]",
        badge: "bg-amber-100 text-amber-800",
        accent: "text-amber-700",
      };
}

function getIssueBeginnerActionHref(issueId: string) {
  return `/issues/${issueId}?filter=ballotMeasures`;
}

function toBattlegroundItem(
  id: string,
  href: string,
  label: string,
  title: string,
  detail: string,
  meta: string[] = [],
): IssueBattlegroundItem {
  return { id, href, label, title, detail, meta };
}

function buildSideSummary(
  side: IssueSide,
  issueText: string,
  counts: { contributions: number; evidence: number; debatesAndPolls: number; audio: number },
  frame: IssueFrame,
) {
  if (side === "support") {
    return `People on this side are arguing to ${frame.supportLabel.toLowerCase()} through ${counts.evidence} evidence and development signal${counts.evidence === 1 ? "" : "s"}, ${counts.debatesAndPolls} active debate or poll lane${counts.debatesAndPolls === 1 ? "" : "s"}, ${counts.contributions} structured public contribution${counts.contributions === 1 ? "" : "s"}, and ${counts.audio} audio briefing${counts.audio === 1 ? "" : "s"}.`;
  }

  return `People on this side are arguing to ${frame.opposeLabel.toLowerCase()} through ${counts.evidence} evidence or scrutiny signal${counts.evidence === 1 ? "" : "s"}, ${counts.debatesAndPolls} debate or poll lane${counts.debatesAndPolls === 1 ? "" : "s"}, ${counts.contributions} structured counterargument${counts.contributions === 1 ? "" : "s"}, and ${counts.audio} audio counterpoint${counts.audio === 1 ? "" : "s"}.`;
}

function pushClassifiedItem(
  side: IssueSide | "mixed",
  item: IssueBattlegroundItem,
  buckets: {
    support: IssueBattlegroundItem[];
    oppose: IssueBattlegroundItem[];
    shared: IssueBattlegroundItem[];
  },
) {
  if (side === "support") {
    buckets.support.push(item);
    return;
  }

  if (side === "oppose") {
    buckets.oppose.push(item);
    return;
  }

  buckets.shared.push(item);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isAudioPost(post: PostSummary) {
  return post.postType === "AUDIO" && Boolean(post.mediaUrl);
}

function getIssueAudioFormatLabel(post: PostSummary) {
  if (post.audioFormatLabel) {
    return post.audioFormatLabel;
  }

  if (post.contentType === "interview") {
    return "Issue Interview";
  }

  if (post.authorRole === "media") {
    return "Issue Explainer";
  }

  if (post.authorRole === "official" || post.authorRole === "candidate") {
    return "Public Response";
  }

  return "Audio Briefing";
}

function toIssueAudioPreviewItem(post: PostSummary, sideLabel: string): IssueAudioPreviewItem {
  return {
    id: `audio-${post.id}`,
    href: getContentDetailHref(post),
    title: post.title?.trim() || `${post.authorName} audio`,
    summary: post.content,
    contributor:
      post.interviewerName ||
      post.interviewSubjectName ||
      post.authorName,
    durationLabel: post.mediaDurationLabel ?? "Audio",
    formatLabel: getIssueAudioFormatLabel(post),
    sideLabel,
    audioUrl: post.mediaUrl!,
    issueTags: post.issueTags?.slice(0, 2) ?? [],
  };
}

function PreviewCard({ item }: { item: IssuePreviewCard }) {
  const theme = getContentTypeTheme(item.label);

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${theme.badge}`}>{item.label}</span>
        {item.meta.map((meta) => (
          <span key={`${item.id}-${meta}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {meta}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-500">{item.subtitle}</p>
      <h2 className="mt-2 text-lg font-semibold text-ink">{item.title}</h2>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{item.description}</p>
      <div className="mt-5">
        <Link
          href={item.href}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          Open
        </Link>
      </div>
    </article>
  );
}

function SideList({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: IssueBattlegroundItem[];
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-[1.25rem] border border-white/80 bg-white/90 p-4 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getContentTypeTheme(item.label).badge}`}>
                  {item.label}
                </span>
                {item.meta?.map((meta) => (
                  <span key={`${item.id}-${meta}`} className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                    {meta}
                  </span>
                ))}
              </div>
              <h3 className="mt-3 text-base font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
              <Link href={item.href} className="mt-3 inline-flex text-sm font-semibold text-civic-700 hover:text-civic-900">
                Open source
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-[1.25rem] bg-white/80 p-4 text-sm text-slate-600 ring-1 ring-slate-200">{emptyText}</div>
      )}
    </div>
  );
}

function SharedBattlegroundList({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: IssueBattlegroundItem[];
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-[1.25rem] border border-slate-100 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getContentTypeTheme(item.label).badge}`}>
                  {item.label}
                </span>
                {item.meta?.map((meta) => (
                  <span key={`${item.id}-${meta}`} className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                    {meta}
                  </span>
                ))}
              </div>
              <h3 className="mt-3 text-base font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
              <Link href={item.href} className="mt-3 inline-flex text-sm font-semibold text-civic-700 hover:text-civic-900">
                Open
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-600">{emptyText}</div>
      )}
    </div>
  );
}

function AudioList({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: IssueAudioPreviewItem[];
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-[1.25rem] border border-white/80 bg-white/90 p-4 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getContentTypeTheme("Audio").badge}`}>
                  {item.formatLabel}
                </span>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">{item.sideLabel}</span>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">{item.contributor}</span>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">{item.durationLabel}</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
              {item.issueTags.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.issueTags.map((tag) => (
                    <span key={`${item.id}-${tag}`} className="rounded-full bg-civic-50 px-3 py-1 text-[11px] font-semibold text-civic-700">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-civic-700 hover:text-civic-900">Play audio</summary>
                <div className="mt-3 rounded-[1rem] border border-slate-200 bg-slate-50 p-3">
                  <audio controls preload="none" className="w-full" src={item.audioUrl}>
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              </details>
              <Link href={item.href} className="mt-3 inline-flex text-sm font-semibold text-civic-700 hover:text-civic-900">
                Open full post
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-[1.25rem] bg-white/80 p-4 text-sm text-slate-600 ring-1 ring-slate-200">{emptyText}</div>
      )}
    </div>
  );
}

function IssueSidePanel({
  side,
  issueId,
  issueText,
  returnPath,
  guestMode,
  issueSupported,
  issueSupportCount,
  data,
}: {
  side: IssueSide;
  issueId: string;
  issueText: string;
  returnPath: string;
  guestMode: boolean;
  issueSupported: boolean;
  issueSupportCount: number;
  data: IssueSideData;
}) {
  const theme = getSideTheme(side);
  const frame = getIssueFrame(issueText);
  const sideLabel = side === "support" ? frame.supportLabel : frame.opposeLabel;

  return (
    <section className={`rounded-[1.85rem] border p-6 shadow-card backdrop-blur ${theme.shell}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${theme.badge}`}>
              {side === "support" ? "Direction A" : "Direction B"}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {data.contributions.length} structured contribution{data.contributions.length === 1 ? "" : "s"}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{sideLabel}</h2>
          <p className="mt-2 text-sm font-medium text-slate-600">{issueText}</p>
          <p className="mt-3 text-sm leading-7 text-slate-700">{data.summary}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {side === "support" ? (
            guestMode ? (
              <Link
                href="/get-started?step=account"
                className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                Verify to participate
              </Link>
            ) : (
              <>
                <form action={toggleTopIssueUpvote}>
                  <input type="hidden" name="issueId" value={issueId} />
                  <input type="hidden" name="returnPath" value={returnPath} />
                  <FormSubmitButton
                    idleLabel={issueSupported ? `${frame.supportActionLabel} · ${issueSupportCount}` : `${frame.supportActionLabel} · ${issueSupportCount}`}
                    pendingLabel="Updating..."
                    className={
                      issueSupported
                        ? "rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        : "rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    }
                  />
                </form>
              </>
            )
          ) : (
            <Link
              href={data.primaryActionHref}
              className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {frame.opposeActionLabel}
            </Link>
          )}
        </div>
      </div>

      {data.momentum.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {data.momentum.map((point) => (
            <span key={point} className={`rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-200 ${theme.accent}`}>
              {point}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-6 space-y-6">
        <SideList
          title="Trusted and public-actor contributions"
          emptyText={
            side === "support"
              ? "No trusted-citizen, candidate, or official support briefs are surfaced yet."
              : "No trusted-citizen, candidate, or official opposition briefs are surfaced yet."
          }
          items={data.contributions}
        />
        <SideList
          title="Evidence, cases, stories, and developments"
          emptyText="No cited developments are surfaced on this side yet."
          items={data.evidence}
        />
        <AudioList
          title="Audio briefings, interviews, and responses"
          emptyText="No issue-linked audio is surfaced on this side yet."
          items={data.audio}
        />
      </div>
    </section>
  );
}

function Section({
  issueId,
  filter,
  title,
  description,
  items,
  sectionKey,
}: {
  issueId: string;
  filter: IssueFilter;
  title: string;
  description: string;
  items: IssuePreviewCard[];
  sectionKey: Exclude<IssueFilter, "all">;
}) {
  const visibleItems = filter === "all" ? items.slice(0, 2) : items;

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">{title}</p>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>
        {filter === "all" ? (
          <Link href={buildIssueHref(issueId, sectionKey)} scroll={false} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
            View all
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {visibleItems.length ? (
          visibleItems.map((item) => <PreviewCard key={`${sectionKey}-${item.id}`} item={item} />)
        ) : (
          <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">No connected {title.toLowerCase()} yet.</div>
        )}
      </div>
    </section>
  );
}

function buildStateSupportBreakdown(posts: PostSummary[]) {
  const stateMap = new Map<string, { support: number; oppose: number; neutral: number; explain: number; total: number }>();

  for (const post of posts) {
    const state = getStateBucket(post.jurisdictionName);
    const current = stateMap.get(state) ?? { support: 0, oppose: 0, neutral: 0, explain: 0, total: 0 };
    const stance = post.stance === "support" || post.stance === "oppose" || post.stance === "neutral" ? post.stance : "explain";
    current[stance] += 1;
    current.total += 1;
    stateMap.set(state, current);
  }

  return [...stateMap.entries()]
    .map(([state, counts]) => ({ state, ...counts }))
    .sort((a, b) => b.total - a.total || a.state.localeCompare(b.state));
}

function IssueVoiceForm({ issueId, issueText }: { issueId: string; issueText: string }) {
  const frame = getIssueFrame(issueText);

  return (
    <form action={submitIssueCitizenVoice} className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-5">
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="issueText" value={issueText} />
      <div className="grid gap-4 md:grid-cols-[0.55fr_1fr]">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-ink">Your position</span>
          <select
            name="stance"
            defaultValue="explain"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
          >
            <option value="explain">{frame.neutralPrompt}</option>
            <option value="support">{frame.supportLabel}</option>
            <option value="oppose">{frame.opposeLabel}</option>
            <option value="neutral">Neutral / unsure</option>
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-ink">Headline</span>
          <input
            name="title"
            required
            maxLength={120}
            placeholder="What should people understand?"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-civic-500"
          />
        </label>
      </div>
      <label className="mt-4 block space-y-2">
        <span className="text-sm font-semibold text-ink">Your structured contribution</span>
        <textarea
          name="content"
          required
          minLength={20}
          rows={5}
          placeholder="Share what you have seen, what tradeoff matters, or what local impact people should pay attention to."
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition placeholder:text-slate-400 focus:border-civic-500"
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-xs leading-5 text-slate-500">
          Citizen posts are separated from official/source-backed records. They can help people follow local voices and identify potential community leaders, but they are not treated as verified public records.
        </p>
        <FormSubmitButton
          idleLabel="Post to issue"
          pendingLabel="Posting..."
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        />
      </div>
    </form>
  );
}

async function CitizenIssueVoicesSection({
  issue,
  currentUser,
  status,
  error,
}: {
  issue: TopIssueSummary;
  currentUser: AuthUser;
  status?: string;
  error?: string;
}) {
  const posts = await getFeedPostPreviews("forYou", { viewerUserId: currentUser.id, limit: -1 }).catch(() => []);
  const citizenPosts = sortCitizenIssuePosts(
    posts
      .filter(isRealCitizenIssuePost)
      .filter((post) => valuesMatchIssueText(issue.issueText, ...(post.issueTags ?? []), post.title, post.content))
      .filter((post) => post.authorRole === "citizen" || post.authorRole === "trustedCitizen" || post.authorRole === "verified_resident"),
    currentUser,
  );
  const stateBreakdown = buildStateSupportBreakdown(citizenPosts);
  const canPost = canSubmitIssueVoice(currentUser);
  const isNationalIssue = issue.jurisdictionName === "United States" || issue.scope === "national";
  const frame = getIssueFrame(issue.issueText);

  return (
    <section id="citizen-voices" className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Citizen voices</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">What registered citizens are saying</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
            Local posts appear first, followed by state and national voices. This is the participation layer for residents; source-backed government records stay in the sections below.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {citizenPosts.length} citizen post{citizenPosts.length === 1 ? "" : "s"}
        </span>
      </div>

      {status === "created" ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Your issue contribution was posted.
        </div>
      ) : null}
      {error ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {error === "registered-citizens-only"
            ? "Only signed-in registered citizen accounts can post to issues right now."
            : "Please add a headline and at least a short explanation before posting."}
        </div>
      ) : null}

      {canPost ? (
        <IssueVoiceForm issueId={issue.id} issueText={issue.issueText} />
      ) : (
        <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
          Sign in with a registered citizen account to post your own structured contribution. Browsing, source records, and existing citizen posts remain public.
        </div>
      )}

      {isNationalIssue ? (
        <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Support by state</p>
          {stateBreakdown.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {stateBreakdown.map((state) => (
                <div key={state.state} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink">{state.state}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{state.total} posts</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {state.support} support · {state.oppose} oppose · {state.neutral} neutral · {state.explain} explain
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              No real citizen submissions are available yet, so state-level support is intentionally empty.
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {citizenPosts.length ? (
          citizenPosts.slice(0, 6).map((post) => (
            <article key={post.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                  {post.stance === "support" ? frame.supportLabel : post.stance === "oppose" ? frame.opposeLabel : post.stance === "neutral" ? "Neutral" : "Context"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{post.jurisdictionName}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatDate(post.createdAt)}</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-ink">{post.title ?? `${post.authorName} contribution`}</h3>
              <p className="mt-2 text-sm text-slate-500">
                {post.authorName} · {post.authorRole === "trustedCitizen" ? "trusted citizen" : "registered citizen"}
              </p>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{post.content}</p>
              <Link href={getContentDetailHref(post)} className="mt-4 inline-flex text-sm font-semibold text-civic-700 hover:text-civic-900">
                Open post
              </Link>
            </article>
          ))
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            No real citizen posts are available for this issue yet. Seeded demo voices are hidden outside explicit demo mode.
          </div>
        )}
      </div>
    </section>
  );
}

async function IssueBriefSection({
  issueId,
  issueText,
  currentUser,
}: {
  issueId: string;
  issueText: string;
  currentUser: AuthUser;
}) {
  const [posts, events, debates, petitions, cases, elections, polls, media] = await Promise.all([
    getFeedPostPreviews("forYou", { viewerUserId: currentUser.id, limit: 10 }).catch(() => []),
    getDiscoverableEventsForUser(currentUser, { limit: 10 }).catch(() => []),
    getDebatesForUser(currentUser, { status: "all" }).catch(() => []),
    getAllPetitions().catch(() => []),
    getAllCases(currentUser).catch(() => []),
    getElectionSummaries(currentUser.id).catch(() => []),
    getFeedPollPreviews({ viewerUserId: currentUser.id, limit: 10 }).catch(() => []),
    getFeedMediaPreviews({ viewerUserId: currentUser.id, limit: -1 }).catch(() => []),
  ]);

  const relatedPosts = posts
    .filter(isRealCitizenIssuePost)
    .filter((post) => valuesMatchIssueText(issueText, ...(post.issueTags ?? []), post.title, post.content));
  const relatedEvents = events.filter((event) => valuesMatchIssueText(issueText, event.issueLabel, event.title, event.description));
  const relatedDebates = debates
    .filter((debate) => isRealIssueDebate(debate.id))
    .filter((debate) => valuesMatchIssueText(issueText, debate.issueText, debate.title, debate.description));
  const relatedPetitions = petitions.filter((petition) => valuesMatchIssueText(issueText, ...(petition.issueTags ?? []), petition.title, petition.summary, petition.body));
  const relatedCases = cases.filter((caseItem) => valuesMatchIssueText(issueText, ...caseItem.issueTags, caseItem.title, caseItem.summary));
  const relatedPolls = polls.filter((poll) => valuesMatchIssueText(issueText, poll.question, ...poll.options));
  const relatedNews = media.filter((story) => mediaStoryMatchesIssue(issueText, story));
  const relatedMeasures = elections.flatMap((election) =>
    election.ballotInitiatives.filter((initiative) => valuesMatchIssueText(issueText, ...initiative.relatedIssues, initiative.title, initiative.summary)),
  );

  const publicResponses = relatedPosts.filter((post) => post.authorRole === "candidate" || post.authorRole === "official" || post.authorRole === "trustedCitizen");
  const summary = relatedNews.length || relatedEvents.length
    ? `${issueText} is being shaped right now by ${relatedNews.length} relevant news stor${relatedNews.length === 1 ? "y" : "ies"}, ${relatedEvents.length} public event${relatedEvents.length === 1 ? "" : "s"}, and ${publicResponses.length} visible response${publicResponses.length === 1 ? "" : "s"} from candidates, officials, or trusted citizens. ${relatedPetitions.length || relatedDebates.length || relatedPolls.length ? `Public momentum is also showing up through ${relatedPetitions.length} petition${relatedPetitions.length === 1 ? "" : "s"}, ${relatedDebates.length} debate${relatedDebates.length === 1 ? "" : "s"}, and ${relatedPolls.length} poll${relatedPolls.length === 1 ? "" : "s"}.` : ""}`
    : `This issue is being tested through ${relatedPetitions.length} petition${relatedPetitions.length === 1 ? "" : "s"}, ${relatedDebates.length} debate${relatedDebates.length === 1 ? "" : "s"}, ${relatedPolls.length} poll${relatedPolls.length === 1 ? "" : "s"}, and ${relatedCases.length} case${relatedCases.length === 1 ? "" : "s"} right now.`;
  const bullets = [
    relatedNews[0]
      ? `${relatedNews[0].title} is one of the clearest stories shaping how this issue is being discussed.`
      : null,
    relatedEvents[0]
      ? `${relatedEvents[0].title} is the nearest public development tied directly to this issue.`
      : null,
    publicResponses[0] ? `${publicResponses[0].authorName} is one of the most visible public actors responding to this issue.` : null,
    relatedDebates[0] ? `${relatedDebates[0].title} is the most visible structured debate tied to this issue.` : null,
  ].filter((value): value is string => Boolean(value));
  const nextActionHref = relatedEvents[0]
    ? `/events/${relatedEvents[0].id}`
    : relatedPetitions[0]
    ? `/petitions/${relatedPetitions[0].id}`
    : relatedDebates[0]
      ? `/debates/${relatedDebates[0].id}`
        : relatedNews[0]
          ? `/news/${relatedNews[0].id}`
          : `/issues/${issueId}?filter=posts`;
  const nextActionLabel = relatedEvents[0]
    ? "Open event"
    : relatedPetitions[0]
    ? "Open petition"
    : relatedDebates[0]
      ? "Open debate"
      : relatedNews[0]
        ? "Open story"
        : "View related perspectives";

  return (
    <SummaryBriefPanel
      eyebrow="Issue Brief"
      title={`What is moving around ${issueText}`}
      summary={summary}
      bullets={bullets}
      actionLabel={nextActionLabel}
      actionHref={nextActionHref}
    />
  );
}

async function IssueReviewRequestsSection({ issueText }: { issueText: string }) {
  const requests = await getIssueReviewRequestsForIssue(issueText).catch(() => []);

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Community input</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Submitted concerns and evidence for review</h2>
          <p className="mt-2 text-sm text-slate-600">
            Issue requests are not court cases. Reviewers can connect them to public legal records, meetings, officials, agencies, news, spending, and projects after source review.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {requests.length} request{requests.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {requests.length ? (
          requests.slice(0, 4).map((request) => (
            <article key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{request.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{request.category} · {request.community}</p>
                </div>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{request.status.replaceAll("_", " ")}</span>
              </div>
              {request.proposedSummary ? <p className="mt-3 text-sm leading-6 text-slate-600">{request.proposedSummary}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1">{request.evidence.length} evidence</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{request.identifiedAgencies.length} agencies</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{request.identifiedCourtCaseNumbers.length} case numbers</span>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 lg:col-span-2">
            No issue review requests have been linked to this issue yet.
          </div>
        )}
      </div>
    </section>
  );
}

async function IssueHubRecordSection({ issueParam }: { issueParam: string }) {
  const record = await getIssueHubRecordByRouteParam(issueParam);

  if (!record) {
    return null;
  }

  const metrics = [
    ["Meetings", record.relationshipCounts.meetings],
    ["Agenda items", record.relationshipCounts.agendaItems],
    ["Voting cards", record.relationshipCounts.votingCards],
    ["Court records", record.relationshipCounts.courtCases],
    ["Submissions", record.relationshipCounts.communitySubmissions],
    ["Source documents", record.relationshipCounts.sourceDocuments],
  ].filter(([, count]) => Number(count) > 0);

  return (
    <section className="rounded-[1.75rem] border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.9),rgba(255,255,255,0.98))] p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Source-backed facts</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Official records connected to this issue</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This issue was generated from imported civic records, then linked back to official meeting records, agenda items, voting cards, legal records, and source documents.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Source-backed</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {record.reviewStatus.replaceAll("_", " ")}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {Math.round(record.confidence * 100)}% confidence
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(([label, count]) => (
          <div key={label} className="rounded-2xl border border-emerald-100 bg-white/85 p-4">
            <p className="text-2xl font-semibold text-ink">{count}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {record.sourceTypes.map((sourceType) => (
          <span key={sourceType} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            {sourceType.replaceAll("_", " ")}
          </span>
        ))}
      </div>

      {record.relatedSourceUrls.length ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sample sources</p>
          <div className="mt-2 grid gap-2">
            {record.relatedSourceUrls.slice(0, 3).map((url) => (
              <a key={url} href={url} className="truncate rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-civic-700 transition hover:text-civic-900">
                {url}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

async function IssueBattlegroundSection({
  issue,
  currentUser,
  guestMode,
}: {
  issue: TopIssueSummary;
  currentUser: AuthUser;
  guestMode: boolean;
}) {
  const [posts, events, debates, petitions, cases, elections, polls, media, people, organizations] = await Promise.all([
    getFeedPostPreviews("forYou", { viewerUserId: currentUser.id, limit: 24 }).catch(() => []),
    getDiscoverableEventsForUser(currentUser, { limit: 18 }).catch(() => []),
    getDebatesForUser(currentUser, { status: "all" }).catch(() => []),
    getAllPetitions().catch(() => []),
    getAllCases(currentUser).catch(() => []),
    getElectionSummaries(currentUser.id).catch(() => []),
    getFeedPollPreviews({ viewerUserId: currentUser.id, limit: 18 }).catch(() => []),
    getFeedMediaPreviews({ viewerUserId: currentUser.id, limit: -1 }).catch(() => []),
    getPeopleForIssue(currentUser, issue.issueText).catch(() => []),
    getOrganizationsForIssue(currentUser, issue.issueText).catch(() => []),
  ]);

  const support: Omit<IssueSideData, "summary" | "primaryActionLabel" | "primaryActionHref"> = {
    contributions: [],
    evidence: [],
    audio: [],
    momentum: [],
  };
  const oppose: Omit<IssueSideData, "summary" | "primaryActionLabel" | "primaryActionHref"> = {
    contributions: [],
    evidence: [],
    audio: [],
    momentum: [],
  };
  const sharedContext: IssueBattlegroundItem[] = [];
  const sharedAudio: IssueAudioPreviewItem[] = [];

  const relatedPosts = posts
    .filter(isRealCitizenIssuePost)
    .filter((post) => valuesMatchIssueText(issue.issueText, ...(post.issueTags ?? []), post.title, post.content));
  const relatedAudioPosts = relatedPosts
    .filter((post) => isAudioPost(post))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const structuredContributions = relatedPosts
    .filter((post) => !isAudioPost(post))
    .filter((post) => post.authorRole === "trustedCitizen" || post.authorRole === "candidate" || post.authorRole === "official")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  for (const post of structuredContributions) {
    const side = classifyIssuePosition(post.title, post.content);
    const item = toBattlegroundItem(
      `contribution-${post.id}`,
      getContentDetailHref(post),
      "Structured contribution",
      post.title ?? `${post.authorName} contribution`,
      `${post.authorName} (${post.authorRole}) added a public argument${post.sharedItem ? ` linked to ${post.sharedItem.title}` : ""}.`,
      [post.jurisdictionName],
    );

    pushClassifiedItem(side, item, {
      support: support.contributions,
      oppose: oppose.contributions,
      shared: sharedContext,
    });
  }

  for (const post of relatedAudioPosts) {
    const side = classifyIssuePosition(post.title, post.content, post.audioFormatLabel);
    const item = toIssueAudioPreviewItem(
      post,
      side === "support" ? "Support case" : side === "oppose" ? "Opposition case" : "Shared context",
    );

    if (side === "support") {
      support.audio.push(item);
      continue;
    }

    if (side === "oppose") {
      oppose.audio.push(item);
      continue;
    }

    sharedAudio.push(item);
  }

  const relatedNews = media.filter((story) => mediaStoryMatchesIssue(issue.issueText, story));
  for (const story of relatedNews) {
    const side = classifyIssuePosition(story.title);
    const item = toBattlegroundItem(
      `news-${story.id}`,
      `/news/${story.id}`,
      "News",
      story.title,
      `${story.sourceName} is shaping the current conversation${story.biasLabel ? ` with perceived ${story.biasLabel} framing` : ""}.`,
      [story.jurisdictionName],
    );
    pushClassifiedItem(side, item, {
      support: support.evidence,
      oppose: oppose.evidence,
      shared: sharedContext,
    });
  }

  const relatedEvents = events.filter((event) => valuesMatchIssueText(issue.issueText, event.issueLabel, event.title, event.description));
  for (const event of relatedEvents) {
    const side = classifyIssuePosition(event.title, event.description);
    const item = toBattlegroundItem(
      `event-${event.id}`,
      `/events/${event.id}`,
      "Event",
      event.title,
      `${getCommunityEventTypeLabel(event.eventType)} in ${event.jurisdictionName} with ${event.attendanceCount} people engaged.`,
      [formatDate(event.startsAt)],
    );
    pushClassifiedItem(side, item, {
      support: support.evidence,
      oppose: oppose.evidence,
      shared: sharedContext,
    });
  }

  const relatedPetitions = petitions.filter((petition) => valuesMatchIssueText(issue.issueText, ...(petition.issueTags ?? []), petition.title, petition.summary, petition.body));
  for (const petition of relatedPetitions) {
    support.evidence.push(
      toBattlegroundItem(
        `petition-${petition.id}`,
        `/petitions/${petition.id}`,
        "Petition",
        petition.title,
        `${petition.signatureCount} supporters are trying to move this issue into public action.`,
        [petition.jurisdictionName],
      ),
    );
  }

  const relatedCases = cases.filter((caseItem) => valuesMatchIssueText(issue.issueText, ...caseItem.issueTags, caseItem.title, caseItem.summary));
  for (const caseItem of relatedCases) {
    const side = classifyIssuePosition(caseItem.title, caseItem.summary);
    const item = toBattlegroundItem(
      `case-${caseItem.id}`,
      `/cases/${caseItem.id}`,
      "Case",
      caseItem.title,
      `${caseItem.status} ${caseItem.stage.toLowerCase()} case testing this issue in public-interest channels.`,
      [caseItem.jurisdictionName],
    );
    pushClassifiedItem(side, item, {
      support: support.evidence,
      oppose: oppose.evidence,
      shared: sharedContext,
    });
  }

  const relatedMeasures = elections.flatMap((election) =>
    election.ballotInitiatives
      .filter((initiative) => valuesMatchIssueText(issue.issueText, ...initiative.relatedIssues, initiative.title, initiative.summary))
      .map((initiative) =>
        toBattlegroundItem(
          `measure-${initiative.id}`,
          `/initiatives/${initiative.id}`,
          "Ballot measure",
          initiative.title,
          `${election.title} is carrying this issue into a formal election choice.`,
          [formatDate(election.electionDate)],
        ),
      ),
  );
  support.evidence.push(...relatedMeasures);
  const frame = getIssueFrame(issue.issueText);

  const relatedDebates = debates
    .filter((debate) => isRealIssueDebate(debate.id))
    .filter((debate) => valuesMatchIssueText(issue.issueText, debate.issueText, debate.title, debate.description));
  const battlegroundDebates = relatedDebates.slice(0, 3).map((debate) =>
    toBattlegroundItem(
      `debate-${debate.id}`,
      `/debates/${debate.id}`,
      "Debate",
      debate.title,
      `${debate.turnCount} published turn${debate.turnCount === 1 ? "" : "s"} and ${debate.followerCount} follower${debate.followerCount === 1 ? "" : "s"} are keeping this argument active.`,
      [debate.jurisdictionName],
    ),
  );
  const relatedPolls = polls.filter((poll) => valuesMatchIssueText(issue.issueText, poll.question, ...poll.options));
  const battlegroundPolls = relatedPolls.slice(0, 3).map((poll) =>
    toBattlegroundItem(
      `poll-${poll.id}`,
      `/polls`,
      "Poll",
      poll.question,
      `${poll.totalVotes} public vote${poll.totalVotes === 1 ? "" : "s"} are already testing sentiment on this question.`,
      [poll.jurisdictionName],
    ),
  );

  if (relatedNews.length) support.momentum.push(`${relatedNews.length} relevant news stor${relatedNews.length === 1 ? "y" : "ies"}`);
  if (relatedEvents.length) support.momentum.push(`${relatedEvents.length} live public development${relatedEvents.length === 1 ? "" : "s"}`);
  if (relatedPetitions.length) support.momentum.push(`${relatedPetitions.length} petition action path${relatedPetitions.length === 1 ? "" : "s"}`);
  if (support.audio.length) support.momentum.push(`${support.audio.length} audio briefing${support.audio.length === 1 ? "" : "s"}`);
  if (relatedDebates.length) oppose.momentum.push(`${relatedDebates.length} active debate${relatedDebates.length === 1 ? "" : "s"}`);
  if (relatedCases.length) oppose.momentum.push(`${relatedCases.length} case${relatedCases.length === 1 ? "" : "s"} testing the issue`);
  if (oppose.audio.length) oppose.momentum.push(`${oppose.audio.length} audio counterpoint${oppose.audio.length === 1 ? "" : "s"}`);
  if (structuredContributions.filter((post) => classifyIssuePosition(post.title, post.content) === "oppose").length) {
    oppose.momentum.push("Visible public counterarguments");
  }

  const supportData: IssueSideData = {
    summary: buildSideSummary("support", issue.issueText, {
      contributions: support.contributions.length,
      evidence: support.evidence.length,
      debatesAndPolls: battlegroundDebates.length + battlegroundPolls.length,
      audio: support.audio.length,
    }, frame),
    contributions: support.contributions.slice(0, 3),
    evidence: support.evidence.slice(0, 4),
    audio: support.audio.slice(0, 2),
    momentum: support.momentum.slice(0, 3),
    primaryActionLabel: "Support issue",
    primaryActionHref: `/issues/${issue.id}`,
  };

  const joinDebateHref = relatedDebates[0] ? `/debates/${relatedDebates[0].id}` : relatedPolls[0] ? "/polls" : buildIssueHref(issue.id, "debates");

  const opposeData: IssueSideData = {
    summary: buildSideSummary("oppose", issue.issueText, {
      contributions: oppose.contributions.length,
      evidence: oppose.evidence.length,
      debatesAndPolls: battlegroundDebates.length + battlegroundPolls.length,
      audio: oppose.audio.length,
    }, frame),
    contributions: oppose.contributions.slice(0, 3),
    evidence: oppose.evidence.slice(0, 4),
    audio: oppose.audio.slice(0, 2),
    momentum: oppose.momentum.slice(0, 3),
    primaryActionLabel: "Oppose issue",
    primaryActionHref: buildIssueHref(issue.id, "debates"),
  };

  const publicActors = structuredContributions.slice(0, 4).map((post) => post.authorName);
  const supportSignalCount = support.contributions.length + support.evidence.length + support.audio.length;
  const opposeSignalCount = oppose.contributions.length + oppose.evidence.length + oppose.audio.length;
  const battlegroundPressureLine =
    supportSignalCount > opposeSignalCount
      ? `Direction A currently has the denser visible case, but ${opposeSignalCount ? "Direction B is still organized enough to keep this contested." : "counterarguments are still thin."}`
      : opposeSignalCount > supportSignalCount
        ? `Direction B currently has the sharper visible case, so pressure is on Direction A and public figures to answer.`
        : `Both sides currently have comparable visible footing, so this issue is genuinely contested right now.`;

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-civic-700">Issue battleground</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Where this issue is publicly contested</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          This page is organized around the strongest visible policy directions, not just a yes/no vote. Trusted citizens, candidates, and officials surface structured contributions, while petitions, debates, polls, cases, news, and events show what is shaping each side.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Direction A</p>
            <p className="mt-1 font-semibold text-ink">{frame.supportLabel}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Direction B</p>
            <p className="mt-1 font-semibold text-ink">{frame.opposeLabel}</p>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm font-medium leading-7 text-ink">{battlegroundPressureLine}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getContentTypeTheme("News Story").subtle}`}>
            {relatedNews.length} news
          </span>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getContentTypeTheme("Event").subtle}`}>
            {relatedEvents.length} events
          </span>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getContentTypeTheme("Debate").subtle}`}>
            {relatedDebates.length} debates
          </span>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getContentTypeTheme("Poll").subtle}`}>
            {relatedPolls.length} polls
          </span>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getContentTypeTheme("Audio").subtle}`}>
            {relatedAudioPosts.length} audio
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            {publicActors.length} visible public responders
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
          <Link href={joinDebateHref} className="text-civic-700 hover:text-civic-900">
            Join the active debate
          </Link>
          <Link href="/polls" className="text-civic-700 hover:text-civic-900">
            Test sentiment in polls
          </Link>
          <Link href="#issue-sourcebook" className="text-civic-700 hover:text-civic-900">
            Open the sourcebook
          </Link>
        </div>
      </section>

      <SharedBattlegroundList
        title="Shared context and contested developments"
        emptyText="No neutral or cross-cutting issue context is surfaced yet."
        items={sharedContext.slice(0, 4)}
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Issue audio</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Explainers, interviews, recaps, and public responses</h2>
            <p className="mt-2 text-sm text-slate-600">
              Audio lives inside the issue ecosystem here, with neutral explainers up front and side-specific responses staying with the case they reinforce.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <AudioList
            title="Shared explainers and balanced audio"
            emptyText="No neutral issue-linked audio is surfaced yet."
            items={sharedAudio.slice(0, 3)}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <IssueSidePanel
          side="support"
          issueId={issue.id}
          issueText={issue.issueText}
          returnPath={`/issues/${issue.id}`}
          guestMode={guestMode}
          issueSupported={issue.viewerHasUpvoted}
          issueSupportCount={issue.upvoteCount}
          data={supportData}
        />
        <IssueSidePanel
          side="oppose"
          issueId={issue.id}
          issueText={issue.issueText}
          returnPath={`/issues/${issue.id}`}
          guestMode={guestMode}
          issueSupported={issue.viewerHasUpvoted}
          issueSupportCount={issue.upvoteCount}
          data={opposeData}
        />
      </div>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Debates and polls</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Where argument and sentiment are being tested</h2>
            <p className="mt-2 text-sm text-slate-600">
              Debates and polls live here as shared battleground signals so the issue’s active public contest is visible in one neutral place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={joinDebateHref}
              className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Join Debate
            </Link>
            <Link
              href="/polls"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              View Polls
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <SharedBattlegroundList
            title="Active debates"
            emptyText="No debates are surfaced for this issue yet."
            items={battlegroundDebates}
          />
          <SharedBattlegroundList
            title="Poll previews"
            emptyText="No polls are testing this issue yet."
            items={battlegroundPolls}
          />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Response layer</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Who is publicly responding</h2>
            <p className="mt-2 text-sm text-slate-600">
              Candidates, officials, trusted citizens, organizations, and issue-focused people tied to {issue.issueText}.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-ink">People and public voices</p>
            {people.length ? (
              <ul className="mt-3 space-y-3 text-sm text-slate-700">
                {people.slice(0, 4).map((person) => (
                  <li key={person.id}>
                    <span className="font-semibold text-ink">{person.name}</span> · {person.role} · {person.topIssuesPreview.slice(0, 2).join(" · ")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No public people are strongly tied to this issue yet.</p>
            )}
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-ink">Organizations and groups</p>
            {organizations.length ? (
              <ul className="mt-3 space-y-3 text-sm text-slate-700">
                {organizations.slice(0, 4).map((organization) => (
                  <li key={organization.id}>
                    <span className="font-semibold text-ink">{organization.name}</span> · {organization.jurisdictionName}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No organizations have surfaced as public issue actors yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionFallback({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">{title}</p>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>
      </div>
      <div className="mt-6 rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">Loading preview…</div>
    </section>
  );
}

async function PostsSectionLoader({ issueId, filter, issueText, currentUserId }: { issueId: string; filter: IssueFilter; issueText: string; currentUserId: string }) {
  const posts = await getFeedPostPreviews("forYou", { viewerUserId: currentUserId, limit: 18 }).catch(() => []);
  const items: IssuePreviewCard[] = posts
    .filter(isRealCitizenIssuePost)
    .filter((post) => valuesMatchIssueText(issueText, ...(post.issueTags ?? []), post.title, post.content))
    .map((post) => ({
      id: post.id,
      href: getContentDetailHref(post),
      label: "Post",
      title: post.title ?? `${post.authorName} post`,
      subtitle: `${post.authorName} · ${post.jurisdictionName}`,
      description: post.content,
      meta: [formatDate(post.createdAt)],
    }));

  return <Section issueId={issueId} filter={filter} title="Posts" description="Posts tagged to this issue or clearly centered on the same topic." items={items} sectionKey="posts" />;
}

async function EventsSectionLoader({ issueId, filter, issueText, currentUser }: { issueId: string; filter: IssueFilter; issueText: string; currentUser: AuthUser }) {
  const events = await getDiscoverableEventsForUser(currentUser, { limit: 18 }).catch(() => []);
  const items: IssuePreviewCard[] = events
    .filter((event) => valuesMatchIssueText(issueText, event.issueLabel, event.title, event.description))
    .map((event) => ({
      id: event.id,
      href: `/events/${event.id}`,
      label: "Event",
      title: event.title,
      subtitle: `${event.jurisdictionName} · ${getCommunityEventTypeLabel(event.eventType)}`,
      description: event.description,
      meta: [formatDate(event.startsAt), `${event.attendanceCount} attending`],
    }));

  return <Section issueId={issueId} filter={filter} title="Events" description="Issue-linked public meetings, rallies, interviews, and community events." items={items} sectionKey="events" />;
}

async function NewsSectionLoader({ issueId, filter, issueText, currentUserId }: { issueId: string; filter: IssueFilter; issueText: string; currentUserId: string }) {
  const stories = await getFeedMediaPreviews({ viewerUserId: currentUserId, limit: -1 }).catch(() => []);
  const items: IssuePreviewCard[] = stories
    .filter((story) => mediaStoryMatchesIssue(issueText, story))
    .map((story) => ({
      id: story.id,
      href: `/news/${story.id}`,
      label: "News",
      title: story.title,
      subtitle: `${story.sourceName} · ${story.jurisdictionName}`,
      description: story.summary,
      meta: [formatDate(story.createdAt), story.biasLabel ? `${story.biasLabel} bias rating` : "Bias rating pending"],
    }));

  return <Section issueId={issueId} filter={filter} title="News" description="Published news stories tagged to this issue or clearly centered on the same topic." items={items} sectionKey="news" />;
}

async function DebatesSectionLoader({ issueId, filter, issueText, currentUser }: { issueId: string; filter: IssueFilter; issueText: string; currentUser: AuthUser }) {
  const debates = await getDebatesForUser(currentUser, { status: "all" }).catch(() => []);
  const items: IssuePreviewCard[] = debates
    .filter((debate) => isRealIssueDebate(debate.id))
    .filter((debate) => valuesMatchIssueText(issueText, debate.issueText, debate.title, debate.description))
    .map((debate) => ({
      id: debate.id,
      href: `/debates/${debate.id}`,
      label: "Debate",
      title: debate.title,
      subtitle: debate.jurisdictionName,
      description: debate.description,
      meta: [debate.status === "open" ? "Open" : "Completed"],
    }));

  return <Section issueId={issueId} filter={filter} title="Debates" description="Structured public arguments that explicitly reference this issue." items={items} sectionKey="debates" />;
}

async function PetitionsSectionLoader({ issueId, filter, issueText }: { issueId: string; filter: IssueFilter; issueText: string }) {
  const petitions = await getAllPetitions().catch(() => []);
  const items: IssuePreviewCard[] = petitions
    .filter((petition) => valuesMatchIssueText(issueText, ...(petition.issueTags ?? []), petition.title, petition.summary, petition.body))
    .map((petition) => ({
      id: petition.id,
      href: `/petitions/${petition.id}`,
      label: "Petition",
      title: petition.title,
      subtitle: petition.jurisdictionName,
      description: petition.summary,
      meta: [`${petition.signatureCount} signatures`, petition.status.replaceAll("_", " ")],
    }));

  return <Section issueId={issueId} filter={filter} title="Petitions" description="Petitions carrying this issue into signatures, sponsorship, and drafting." items={items} sectionKey="petitions" />;
}

async function CasesSectionLoader({ issueId, filter, issueText, currentUser }: { issueId: string; filter: IssueFilter; issueText: string; currentUser: AuthUser }) {
  const cases = await getAllCases(currentUser).catch(() => []);
  const items: IssuePreviewCard[] = cases
    .filter((caseItem) => valuesMatchIssueText(issueText, ...caseItem.issueTags, caseItem.title, caseItem.summary))
    .map((caseItem) => ({
      id: caseItem.id,
      href: `/cases/${caseItem.id}`,
      label: "Case",
      title: caseItem.title,
      subtitle: `${caseItem.jurisdictionName} · ${caseItem.stage}`,
      description: caseItem.summary,
      meta: [caseItem.status, caseItem.courtLevel],
    }));

  return <Section issueId={issueId} filter={filter} title="Cases" description="Relevant public-interest cases already tagged to this issue area." items={items} sectionKey="cases" />;
}

async function BallotMeasuresSectionLoader({ issueId, filter, issueText, currentUserId }: { issueId: string; filter: IssueFilter; issueText: string; currentUserId: string }) {
  const elections = await getElectionSummaries(currentUserId).catch(() => []);
  const items: IssuePreviewCard[] = elections
    .flatMap((election) =>
      election.ballotInitiatives
        .filter((initiative) => valuesMatchIssueText(issueText, ...initiative.relatedIssues, initiative.title, initiative.summary))
        .map((initiative) => ({
          id: initiative.id,
          href: `/initiatives/${initiative.id}`,
          label: "Ballot Measure",
          title: initiative.title,
          subtitle: `${initiative.jurisdictionName} · ${election.title}`,
          description: initiative.summary,
          meta: [formatDate(election.electionDate), election.electionStatus],
        })),
    );

  return <Section issueId={issueId} filter={filter} title="Ballot Measures" description="Ballot initiatives and measures connected to this topic." items={items} sectionKey="ballotMeasures" />;
}

async function RelatedPeopleSectionLoader({ issueText, currentUser }: { issueText: string; currentUser: AuthUser }) {
  const people = await getPeopleForIssue(currentUser, issueText).catch(() => []);
  return <RelatedPeopleSection issueText={issueText} people={people} />;
}

async function RelatedOrganizationsSectionLoader({ issueText, currentUser }: { issueText: string; currentUser: AuthUser }) {
  const organizations = await getOrganizationsForIssue(currentUser, issueText).catch(() => []);
  return <RelatedOrganizationsSection issueText={issueText} organizations={organizations} guestMode={isGuestUserId(currentUser.id)} />;
}

async function IssuePositionsSectionLoader({ issueText }: { issueText: string }) {
  const positions = await getIssuePositionsByIssue(issueText).catch((error) => {
    console.error(`[issue-detail] issue positions fallback for ${issueText}`, error);
    return [];
  });
  const sourceItems: SourceExplorerItem[] = positions
    .filter((position) => position.sourceUrl || position.evidenceUrl)
    .map((position) => ({
      id: `${position.id}-issue-source`,
      sourceName: position.sourceName ?? position.evidenceSourceName ?? "Issue position evidence",
      sourceType: "issue_position_evidence",
      sourceUrl: position.sourceUrl ?? position.evidenceUrl,
      lastImportedAt: position.lastObservedAt,
      fieldsDerived: ["issue position", position.issueText, position.subject.type],
      reviewStatus: position.reviewStatus,
      confidenceScore: position.confidenceScore,
      notes: position.summary ?? position.evidenceTitle ?? `Evidence linked to ${position.subject.name}.`,
    }));

  return (
    <>
      <IssuePositionsSection
        positions={positions}
        title="Candidates and officials on this issue"
        description="Approved, source-attributed candidate and official positions normalized to this existing issue page."
        emptyTitle="Related positions pending"
        emptyDescription="No approved, sourced candidate or official positions are available for this issue yet."
        variant="light"
      />
      <SourceExplorer items={sourceItems} emptyText="Issue position source records are pending review." />
    </>
  );
}

export default async function IssueDetailPage({ params, searchParams }: IssueDetailPageProps) {
  const [{ issueId }, resolvedSearchParams] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const activeFilter = normalizeFilter(resolvedSearchParams?.filter);
  const issue = await getIssueByRouteParam(getDefaultSeedUser(), issueId);

  if (!issue) {
    notFound();
  }

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Issue"
        title={issue.plainTitle ?? issue.issueText}
        description={`${issue.whyThisMatters ?? getIssueSummary(issue.issueText)} Official records, platform explanations, and community input are separated below so source-backed facts stay distinct from submitted concerns.`}
        meta={
          <>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">{issue.jurisdictionName}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{issue.category ?? issue.scope}</span>
            {issue.sourceBacked ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Source-backed</span> : null}
            {issue.showDemoBadge ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Demo fallback</span> : null}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <FavoriteToggleControl targetType="issue" targetId={issue.id} />
            <ShareActionMenu
              target={{
                entityType: "issue",
                entityId: issue.id,
                title: issue.issueText,
                href: `/issues/${issue.id}`,
                summary: getIssueSummary(issue.issueText),
                issueTag: issue.issueText,
              }}
              returnPath={`/issues/${issue.id}`}
              guestMode
            />
            <Link
              href={`/voting?search=${encodeURIComponent(issue.issueText)}`}
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              Vote on related questions
            </Link>
            <Link
              href="/issues"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              Browse issues
            </Link>
          </div>
        }
      />

      <IssueDetailContent
        issueId={issue.id}
        issue={issue}
        activeFilter={activeFilter}
        issuePostStatus={resolvedSearchParams?.issuePost}
        issuePostError={resolvedSearchParams?.issuePostError}
      />
    </div>
  );
}

async function IssueDetailContent({
  issueId,
  issue: baseIssue,
  activeFilter,
  issuePostStatus,
  issuePostError,
}: {
  issueId: string;
  issue: NonNullable<Awaited<ReturnType<typeof getIssueByRouteParam>>>;
  activeFilter: IssueFilter;
  issuePostStatus?: string;
  issuePostError?: string;
}) {
  const currentUser = await withSectionTimeout(getCurrentUser(), "issue current user", 1200).catch((error) => {
    console.error(`[issue-detail] current user fallback for ${issueId}`, error);
    return getDefaultSeedUser();
  });
  const resolvedIssue = await withSectionTimeout(getIssueByRouteParam(currentUser, issueId), "issue detail", 1500).catch((error) => {
    console.error(`[issue-detail] issue detail fallback for ${issueId}`, error);
    return baseIssue;
  });
  const safeIssue = resolvedIssue ?? baseIssue;
  const guestMode = isGuestUserId(currentUser.id);
  const relatedAds = getPoliticalAdsForIssue(safeIssue.id, safeIssue.issueText, 4);

  return (
    <>
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Platform explanation</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Understand the issue before you go deep</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">What this issue is</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{getIssueSummary(safeIssue.issueText)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Why people disagree</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  People are usually arguing over cost, urgency, fairness, tradeoffs, or who should be responsible for the next move. The battleground below shows the clearest visible case on both sides.
                </p>
              </div>
              <div className="rounded-2xl bg-civic-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">What happens next</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  This issue can move through public posts, petitions, events, debates, ballot measures, and official responses. You do not need to open everything at once.
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">One thing you can do now</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  Save the issue, read the short brief, and then choose one next step: see both sides, check related ballot items, or open the related cases.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Participation ladder</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink">A beginner-safe path into this issue</h2>
            <div className="mt-4 space-y-2">
              {[
                "Read the short summary",
                "See both sides",
                "Follow the issue",
                "Check one related poll, petition, or ballot item",
                "Open the full sourcebook only if you want the deeper record",
              ].map((step) => (
                <div key={step} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {step}
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={buildIssueHref(issueId, "all")}
                className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Read the short brief
              </Link>
              <Link
                href="#issue-battleground"
                className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                See both sides
              </Link>
              <Link
                href={getIssueBeginnerActionHref(issueId)}
                className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                Check related ballot items
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Suspense
        fallback={
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">Loading issue brief…</div>
          </section>
        }
      >
        <IssueBriefSection issueId={safeIssue.id} issueText={safeIssue.issueText} currentUser={currentUser} />
      </Suspense>

      <Suspense
        fallback={
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">Loading source-backed issue records…</div>
          </section>
        }
      >
        <IssueHubRecordSection issueParam={safeIssue.id} />
      </Suspense>

      <Suspense
        fallback={
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">Loading review requests…</div>
          </section>
        }
      >
        <IssueReviewRequestsSection issueText={safeIssue.issueText} />
      </Suspense>

      <Suspense
        fallback={
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">Loading sourced positions…</div>
          </section>
        }
      >
        <IssuePositionsSectionLoader issueText={safeIssue.issueText} />
      </Suspense>

      <Suspense
        fallback={
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">Loading citizen voices…</div>
          </section>
        }
      >
        <CitizenIssueVoicesSection issue={safeIssue} currentUser={currentUser} status={issuePostStatus} error={issuePostError} />
      </Suspense>

      <Suspense
        fallback={
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">Loading related news…</div>
          </section>
        }
      >
        <NewsSectionLoader issueId={issueId} filter="all" issueText={safeIssue.issueText} currentUserId={currentUser.id} />
      </Suspense>

      <Suspense
        fallback={
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">Loading issue battleground…</div>
          </section>
        }
      >
        <div id="issue-battleground">
          <IssueBattlegroundSection issue={safeIssue} currentUser={currentUser} guestMode={guestMode} />
        </div>
      </Suspense>

      <PoliticalAdsSection
        title="Political ads about this issue"
        description="Compare ads that support, oppose, or mention this issue across sponsors, source types, geography, and truth ratings."
        ads={relatedAds}
        repositoryHref={`/ads?issueId=${encodeURIComponent(safeIssue.id)}`}
        emptyText="No political ads are attached to this issue yet."
      />

      <details id="issue-sourcebook" className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur" open={activeFilter !== "all"}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Issue sourcebook</p>
            <p className="mt-2 text-sm text-slate-600">
              Drill into the underlying posts, events, debates, petitions, cases, ballot measures, and public actors tied to this issue.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Open</span>
        </summary>

        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all" as const, label: "All" },
              { key: "posts" as const, label: "Posts" },
              { key: "events" as const, label: "Events" },
              { key: "news" as const, label: "News" },
              { key: "debates" as const, label: "Debates" },
              { key: "petitions" as const, label: "Petitions" },
              { key: "cases" as const, label: "Cases" },
              { key: "ballotMeasures" as const, label: "Ballot Measures" },
            ].map((filter) => (
              <Link
                key={filter.key}
                href={buildIssueHref(safeIssue.id, filter.key)}
                scroll={false}
                className={
                  filter.key === activeFilter
                    ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                    : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                }
              >
                {filter.label}
              </Link>
            ))}
          </div>

          {activeFilter === "all" ? (
            <div className="space-y-6">
              <Suspense
                fallback={
                  <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
                    <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">Loading related people…</div>
                  </section>
                }
              >
                <RelatedPeopleSectionLoader issueText={safeIssue.issueText} currentUser={currentUser} />
              </Suspense>
              <Suspense
                fallback={
                  <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
                    <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">Loading related organizations…</div>
                  </section>
                }
              >
                <RelatedOrganizationsSectionLoader issueText={safeIssue.issueText} currentUser={currentUser} />
              </Suspense>
            </div>
          ) : null}

          {activeFilter === "all" || activeFilter === "posts" ? (
            <Suspense fallback={<SectionFallback title="Posts" description="Posts tagged to this issue or clearly centered on the same topic." />}>
              <PostsSectionLoader issueId={issueId} filter={activeFilter} issueText={safeIssue.issueText} currentUserId={currentUser.id} />
            </Suspense>
          ) : null}

          {activeFilter === "all" || activeFilter === "events" ? (
            <Suspense fallback={<SectionFallback title="Events" description="Issue-linked public meetings, rallies, interviews, and community events." />}>
              <EventsSectionLoader issueId={issueId} filter={activeFilter} issueText={safeIssue.issueText} currentUser={currentUser} />
            </Suspense>
          ) : null}

          {activeFilter === "all" || activeFilter === "news" ? (
            <Suspense fallback={<SectionFallback title="News" description="Published news stories tagged to this issue or clearly centered on the same topic." />}>
              <NewsSectionLoader issueId={issueId} filter={activeFilter} issueText={safeIssue.issueText} currentUserId={currentUser.id} />
            </Suspense>
          ) : null}

          {activeFilter === "all" || activeFilter === "debates" ? (
            <Suspense fallback={<SectionFallback title="Debates" description="Structured public arguments that explicitly reference this issue." />}>
              <DebatesSectionLoader issueId={issueId} filter={activeFilter} issueText={safeIssue.issueText} currentUser={currentUser} />
            </Suspense>
          ) : null}

          {activeFilter === "all" || activeFilter === "petitions" ? (
            <Suspense fallback={<SectionFallback title="Petitions" description="Petitions carrying this issue into signatures, sponsorship, and drafting." />}>
              <PetitionsSectionLoader issueId={issueId} filter={activeFilter} issueText={safeIssue.issueText} />
            </Suspense>
          ) : null}

          {activeFilter === "all" || activeFilter === "cases" ? (
            <Suspense fallback={<SectionFallback title="Cases" description="Relevant public-interest cases already tagged to this issue area." />}>
              <CasesSectionLoader issueId={issueId} filter={activeFilter} issueText={safeIssue.issueText} currentUser={currentUser} />
            </Suspense>
          ) : null}

          {activeFilter === "all" || activeFilter === "ballotMeasures" ? (
            <Suspense fallback={<SectionFallback title="Ballot Measures" description="Ballot initiatives and measures connected to this topic." />}>
              <BallotMeasuresSectionLoader issueId={issueId} filter={activeFilter} issueText={safeIssue.issueText} currentUserId={currentUser.id} />
            </Suspense>
          ) : null}
        </div>
      </details>
    </>
  );
}
