import type { ReactNode } from "react";
import Link from "next/link";

import { ContentReportControl } from "@/components/domain/content-report-control";
import { CivicBriefPanel } from "@/components/domain/civic-brief-panel";
import { FactualClaimFlagAction } from "@/components/domain/factual-claim-flag-action";
import { FeedFilterList } from "@/components/domain/feed-filter-list";
import { FeedPetitionSupportButton } from "@/components/domain/feed-petition-support-button";
import { FeedPollCard } from "@/components/domain/feed-poll-card";
import { FeedPostCommentsPanel } from "@/components/domain/feed-post-comments-panel";
import { FeedPostTruthPanel } from "@/components/domain/feed-post-truth-panel";
import { FeedSentimentControls } from "@/components/domain/feed-sentiment-controls";
import { FollowButton } from "@/components/domain/follow-button";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageIntro } from "@/components/ui/page-intro";
import { ActionLabel, ScaleIcon } from "@/components/ui/action-icons";
import { canUserFlagFactualClaim } from "@/lib/auth/guards";
import { isGuestUserId } from "@/lib/auth/session";
import { type CivicBriefCadence, getCivicBrief } from "@/lib/server/civic-brief";
import { getCurrentFeedViewer } from "@/lib/server/auth-session";
import { getDefaultSeedUser } from "@/lib/auth/mock-users";
import { getCommunityEventTypeLabel, getFeedEventPreviews, type FeedEventPreview } from "@/lib/community/events";
import { getFeedDebatePreviews, type DebateFeedPreview } from "@/lib/debates/store";
import { getFeedPostPreviews, type FeedMode } from "@/lib/feed/posts";
import { slugifyIssueText } from "@/lib/issues/utils";
import { getFeedMediaPreviews, type MediaFeedPreview } from "@/lib/media/store";
import { mockPosts } from "@/lib/mock-data";
import { getContentDetailHref, getNewsStoryHref, getTruthDetailHref } from "@/lib/news/links";
import { getFeedPetitionPreviews, type FeedPetitionPreview } from "@/lib/petitions/store";
import { getFeedPollPreviews } from "@/lib/polls/store";
import { getContentTypeTheme } from "@/lib/ui/content-type-theme";
import type { PollSummary, PostSummary, UserRole, VoteQuestionScope } from "@/types/domain";

type FeedScope = VoteQuestionScope | "all";

type FeedPageProps = {
  searchParams?: Promise<{
    scope?: string;
    type?: string;
    community?: string;
    view?: string;
    brief?: string;
    denied?: string;
    comment?: string;
    commentError?: string;
    truth?: string;
    truthError?: string;
    claimFlag?: string;
    claimFlagError?: string;
    event?: string;
    eventError?: string;
  }>;
};

type FeedItemType = "post" | "poll" | "petition" | "debate" | "media" | "event";

type FeedPreviewItem = {
  id: string;
  type: FeedItemType;
  scope: FeedScope;
  jurisdictionName?: string;
  createdAt: string;
  preview: ReactNode;
};

type QueryResult<T> = {
  data: T;
  usedFallback: boolean;
};

function normalizeScopes(value: string | undefined): FeedScope[] {
  if (!value) {
    return ["all"];
  }

  const values = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is FeedScope => entry === "all" || entry === "local" || entry === "state" || entry === "national");

  if (!values.length || values.includes("all")) {
    return ["all"];
  }

  return [...new Set(values)];
}

function normalizeView(value: string | undefined): FeedMode {
  if (value === "reliable" || value === "discussed") {
    return value;
  }

  return "forYou";
}

function normalizeBriefCadence(value: string | undefined): CivicBriefCadence {
  if (value === "daily" || value === "monthly") {
    return value;
  }

  return "weekly";
}

function buildFeedReturnPath(params?: Awaited<FeedPageProps["searchParams"]>) {
  const search = new URLSearchParams();

  if (params?.scope) {
    search.set("scope", params.scope);
  }

  if (params?.type) {
    search.set("type", params.type);
  }

  if (params?.community) {
    search.set("community", params.community);
  }

  if (params?.view) {
    search.set("view", params.view);
  }

  if (params?.brief) {
    search.set("brief", params.brief);
  }

  const query = search.toString();
  return query ? `/feed?${query}` : "/feed";
}

function buildFeedHref(
  params: Awaited<FeedPageProps["searchParams"]> | undefined,
  overrides: Partial<Record<"scope" | "type" | "community" | "view" | "brief", string | undefined>>,
) {
  const search = new URLSearchParams();
  const nextParams = {
    scope: overrides.scope ?? params?.scope,
    type: overrides.type ?? params?.type,
    community: overrides.community ?? params?.community,
    view: overrides.view ?? params?.view,
    brief: overrides.brief ?? params?.brief,
  };

  if (nextParams.scope) search.set("scope", nextParams.scope);
  if (nextParams.type) search.set("type", nextParams.type);
  if (nextParams.community) search.set("community", nextParams.community);
  if (nextParams.view) search.set("view", nextParams.view);
  if (nextParams.brief) search.set("brief", nextParams.brief);

  const query = search.toString();
  return query ? `/feed?${query}` : "/feed";
}

function normalizeTypes(value: string | undefined): Array<FeedItemType | "all"> {
  if (!value) {
    return ["all"];
  }

  const values = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(
      (entry): entry is FeedItemType | "all" =>
        entry === "all" || entry === "post" || entry === "poll" || entry === "petition" || entry === "debate" || entry === "media" || entry === "event",
    );

  if (!values.length || values.includes("all")) {
    return ["all"];
  }

  return [...new Set(values)];
}

function formatFeedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getRelativeFeedDate(value: string) {
  const diffMs = Date.parse(value) - Date.now();
  const absoluteMinutes = Math.max(1, Math.round(Math.abs(diffMs) / (1000 * 60)));

  if (absoluteMinutes < 60) {
    return diffMs > 0 ? `in ${absoluteMinutes}m` : `${absoluteMinutes}m ago`;
  }

  const absoluteHours = Math.round(absoluteMinutes / 60);
  if (absoluteHours < 24) {
    return diffMs > 0 ? `in ${absoluteHours}h` : `${absoluteHours}h ago`;
  }

  const absoluteDays = Math.round(absoluteHours / 24);
  return diffMs > 0 ? `in ${absoluteDays}d` : `${absoluteDays}d ago`;
}

function getPostTypeLabel(post: PostSummary) {
  if (post.isEventPost) return "Event Post";
  if (post.contentType === "interview") return post.postType === "AUDIO" ? "Audio Interview" : post.postType === "VIDEO" ? "Citizen Interview" : "Interview";
  if (post.postType === "IMAGE") return "Photo Post";
  if (post.postType === "VIDEO") return "Video Post";
  if (post.postType === "AUDIO") return "Audio Post";
  return "Post";
}

function getPollScopeLabel(poll: PollSummary) {
  if (poll.scope === "local") return "Local Poll";
  if (poll.scope === "state") return "State Poll";
  return "National Poll";
}

function getPetitionPreviewText(petition: FeedPetitionPreview) {
  return petition.summary.length > 180 ? `${petition.summary.slice(0, 177)}...` : petition.summary;
}

function getDebatePreviewText(debate: DebateFeedPreview) {
  return debate.description.length > 180 ? `${debate.description.slice(0, 177)}...` : debate.description;
}

function getPostPreviewText(post: PostSummary) {
  return post.content.length > 220 ? `${post.content.slice(0, 217)}...` : post.content;
}

function getPostContentTypeLabel(post: PostSummary) {
  if (post.contentType === "interview") return "Citizen Interview";
  if (post.contentType === "statementClaim") return "Statement / Claim";
  if (post.contentType === "newsStory") return "News Story";
  if (post.contentType === "opinionPerspective") return "Opinion / Perspective";
  if (post.contentType === "announcementUpdate") return "Announcement / Update";
  if (post.contentType === "questionPoll") return "Question / Poll";
  return "Event";
}

function getPetitionProgressPercent(petition: FeedPetitionPreview) {
  if (!petition.signatureGoal) {
    return 0;
  }

  return Math.min(100, Math.round((petition.signatureCount / petition.signatureGoal) * 100));
}

function timeoutAfter<T>(ms: number, label: string, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.error(`[feed] ${label} timed out after ${ms}ms`);
      resolve(fallback);
    }, ms);
  });
}

async function runFeedQuery<T>({
  label,
  timeoutMs,
  slowMs,
  fallback,
  query,
}: {
  label: string;
  timeoutMs: number;
  slowMs: number;
  fallback: T;
  query: () => Promise<T>;
}): Promise<QueryResult<T>> {
  const startedAt = Date.now();
  console.info(`[feed] ${label} started`);

  try {
    const data = await Promise.race([query(), timeoutAfter(timeoutMs, label, fallback)]);
    const durationMs = Date.now() - startedAt;

    if (durationMs > slowMs) {
      console.warn(`[feed] ${label} slow`, { durationMs });
    }

    console.info(`[feed] ${label} resolved`, {
      durationMs,
      usedFallback: data === fallback,
      count: Array.isArray(data) ? data.length : undefined,
    });

    return { data, usedFallback: data === fallback };
  } catch (error) {
    console.error(`[feed] ${label} failed`, error);
    return { data: fallback, usedFallback: true };
  }
}

async function getSafeCurrentUser() {
  const fallbackUser = { ...getDefaultSeedUser() };
  const result = await runFeedQuery({
    label: "current user lookup",
    timeoutMs: 800,
    slowMs: 300,
    fallback: fallbackUser,
    query: () => getCurrentFeedViewer(),
  });

  return {
    user: result.data,
    usedFallback: result.usedFallback,
  };
}

function getFallbackPosts(scope: FeedScope, localJurisdiction: string) {
  const filtered = mockPosts.filter((post) => {
    if (scope === "all") return true;
    if (scope === "local") return post.jurisdictionName === localJurisdiction;
    if (scope === "state") return post.jurisdictionName === "Nevada";
    return post.jurisdictionName === "United States";
  });

  return filtered
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 8);
}

function getScopedJurisdictions(scope: FeedScope, localJurisdiction: string) {
  if (scope === "all") return undefined;
  if (scope === "local") return [localJurisdiction];
  if (scope === "state") return ["Nevada"];
  return ["United States"];
}

function getItemScope(jurisdictionName: string | null | undefined, localJurisdiction: string): FeedScope {
  if (!jurisdictionName) return "all";
  if (jurisdictionName === localJurisdiction) return "local";
  if (jurisdictionName === "Nevada") return "state";
  if (jurisdictionName === "United States") return "national";
  return "all";
}

async function getSafeFeedPosts(mode: FeedMode, scope: FeedScope, localJurisdiction: string, viewerUserId: string) {
  const fallbackPosts = getFallbackPosts(scope, localJurisdiction);
  const scopedJurisdictions = getScopedJurisdictions(scope, localJurisdiction);
  const result = await runFeedQuery({
    label: "post query",
    timeoutMs: 1500,
    slowMs: 650,
    fallback: fallbackPosts,
    query: () => getFeedPostPreviews(mode, { jurisdictionNames: scopedJurisdictions, limit: 8, viewerUserId }),
  });

  return { posts: result.data, usedFallback: result.usedFallback };
}

async function getSafeFeedPolls(scope: FeedScope, localJurisdiction: string, viewerUserId: string) {
  const fallback: PollSummary[] = [];
  const scopedJurisdictions = getScopedJurisdictions(scope, localJurisdiction);
  const result = await runFeedQuery({
    label: "poll query",
    timeoutMs: 1100,
    slowMs: 450,
    fallback,
    query: () => getFeedPollPreviews({ jurisdictionNames: scopedJurisdictions, limit: 2, viewerUserId }),
  });

  return { polls: result.data, usedFallback: result.usedFallback };
}

async function getSafeFeedPetitions(scope: FeedScope, localJurisdiction: string, viewer: Awaited<ReturnType<typeof getCurrentFeedViewer>>) {
  const fallback: FeedPetitionPreview[] = [];
  const scopedJurisdictions = getScopedJurisdictions(scope, localJurisdiction);
  const result = await runFeedQuery({
    label: "petition query",
    timeoutMs: 1100,
    slowMs: 450,
    fallback,
    query: () => getFeedPetitionPreviews({ jurisdictionNames: scopedJurisdictions, limit: 2, viewer }),
  });

  return { petitions: result.data, usedFallback: result.usedFallback };
}

async function getSafeFeedDebates(scope: FeedScope, localJurisdiction: string) {
  const fallback: DebateFeedPreview[] = [];
  const scopedJurisdictions = getScopedJurisdictions(scope, localJurisdiction);
  const result = await runFeedQuery({
    label: "debate query",
    timeoutMs: 1100,
    slowMs: 450,
    fallback,
    query: () => getFeedDebatePreviews({ jurisdictionNames: scopedJurisdictions, limit: 2 }),
  });

  return { debates: result.data, usedFallback: result.usedFallback };
}

async function getSafeFeedMedia(scope: FeedScope, localJurisdiction: string, viewerUserId: string) {
  const fallback: MediaFeedPreview[] = [];
  const scopedJurisdictions = getScopedJurisdictions(scope, localJurisdiction);
  const result = await runFeedQuery({
    label: "media query",
    timeoutMs: 1100,
    slowMs: 450,
    fallback,
    query: () => getFeedMediaPreviews({ jurisdictionNames: scopedJurisdictions, limit: 2, viewerUserId }),
  });

  return { media: result.data, usedFallback: result.usedFallback };
}

async function getSafeFeedEvents(scope: FeedScope, localJurisdiction: string) {
  const fallback: FeedEventPreview[] = [];
  const scopedJurisdictions = getScopedJurisdictions(scope, localJurisdiction);
  const result = await runFeedQuery({
    label: "event query",
    timeoutMs: 1100,
    slowMs: 450,
    fallback,
    query: () => getFeedEventPreviews({ jurisdictionNames: scopedJurisdictions, limit: 2 }),
  });

  return { events: result.data, usedFallback: result.usedFallback };
}

function renderPostPreview(post: PostSummary, viewerRole: UserRole, returnPath: string, viewerUserId?: string) {
  const canFlagClaim = canUserFlagFactualClaim({ role: viewerRole });
  const showFlagAction = canFlagClaim && !post.truthEligible && !post.claimFlagThresholdReached;
  const guestMode = isGuestUserId(viewerUserId);
  const postTheme = getContentTypeTheme("Post");
  const contentTheme = getContentTypeTheme(getPostContentTypeLabel(post));

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${postTheme.badge}`}>Post</span>
            {post.isEventPost ? (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getContentTypeTheme("Event").subtle}`}>
                Event Post
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {formatFeedDate(post.createdAt)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{post.jurisdictionName}</span>
            {post.viewerFollowsAuthor ? (
              <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
                Following
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-slate-500">
            {post.authorProfileHref ? (
              <Link href={post.authorProfileHref} className="font-semibold text-ink hover:text-civic-700">
                {post.authorName}
              </Link>
            ) : (
              <span className="font-semibold text-ink">{post.authorName}</span>
            )}
            <span>{post.authorRole}</span>
            {post.authorCredibilityLabel ? (
              <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
                {post.authorCredibilityLabel}
              </span>
            ) : null}
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${contentTheme.subtle}`}>{getPostContentTypeLabel(post)}</span>
          </div>
        </div>
        {post.authorId && post.authorViewerCanFollow ? (
          <FollowButton
            targetUserId={post.authorId}
            returnPath={returnPath}
            isFollowing={Boolean(post.authorViewerIsFollowing)}
            className={
              post.authorViewerIsFollowing
                ? "rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                : "rounded-full bg-civic-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            }
          />
        ) : null}
      </div>
      <div className="mt-4 space-y-4">
        {post.title ? <h2 className="text-xl font-semibold text-ink">{post.title}</h2> : null}
        {post.contentType === "interview" && (post.interviewerName || post.interviewSubjectName) ? (
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
            {post.interviewerName ? (
              <span className="rounded-full bg-civic-50 px-3 py-1 text-civic-700">Interviewer · {post.interviewerName}</span>
            ) : null}
            {post.interviewSubjectName ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Subject · {post.interviewSubjectName}</span>
            ) : null}
          </div>
        ) : null}
        <p className="text-base leading-7 text-slate-700">{getPostPreviewText(post)}</p>
        {post.sharedItem ? (
          <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
              {post.shareMode === "repost" ? "Re-posted inside Direct Democracy" : "Post about this civic item"}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">{post.sharedItem.title}</p>
            {post.sharedItem.summary ? <p className="mt-2 text-sm leading-6 text-slate-600">{post.sharedItem.summary}</p> : null}
            <div className="mt-3">
              <Link href={post.sharedItem.href} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
                Open original item
              </Link>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${contentTheme.subtle}`}>
            {getPostTypeLabel(post)}
          </span>
          {post.mediaUrl ? (
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Media attached</span>
          ) : null}
          {post.issueTags?.slice(0, 3).map((tag) => (
            <Link
              key={`${post.id}-${tag}`}
              href={`/issues/${slugifyIssueText(tag)}`}
              className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700 transition hover:text-civic-900"
            >
              {tag}
            </Link>
          ))}
          {post.issueTags && post.issueTags.length > 3 ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              +{post.issueTags.length - 3} more
            </span>
          ) : null}
        </div>
        <FeedPostTruthPanel
          postId={post.id}
          truthEligible={post.truthEligible}
          truthPreviewLabel={post.truthPreviewLabel}
          truthRatingCount={post.truthRatingCount}
          truthDistribution={post.truthDistribution}
        />
        {post.claimFlagCount && !post.claimFlagThresholdReached ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-orange-700">
            <span className="rounded-full bg-orange-50 px-3 py-1 font-semibold">
              {post.claimFlagCount} factual-claim flag{post.claimFlagCount === 1 ? "" : "s"}
            </span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-start gap-3">
          <FeedSentimentControls
            postId={post.id}
            initialUp={post.reactionTotals.up}
            initialDown={post.reactionTotals.down}
            initialSelection={post.viewerReaction ?? null}
            canReact={!guestMode}
          />
          {!guestMode ? (
            <ContentReportControl
              targetType="post"
              targetId={post.id}
              initialReported={Boolean(post.viewerHasReportedContent)}
              compact
            />
          ) : null}
          {!guestMode && showFlagAction ? (
            <FactualClaimFlagAction
              postId={post.id}
              returnPath={returnPath}
              disabled={Boolean(post.viewerHasClaimFlagged)}
              compact
            />
          ) : null}
          {post.truthEligible && !guestMode ? (
            <Link
              href={getTruthDetailHref(post)}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              <ActionLabel icon={<ScaleIcon className="h-4 w-4" />}>Rate Truth</ActionLabel>
            </Link>
          ) : null}
          <ShareActionMenu
            target={{
              entityType: post.contentType === "newsStory" ? "newsStory" : "post",
              entityId: post.id,
              title: post.title?.trim() || getPostPreviewText(post),
              href: getContentDetailHref(post),
              summary: getPostPreviewText(post),
              issueTag: post.issueTags?.[0] ?? null,
            }}
            returnPath={returnPath}
            guestMode={guestMode}
          />
        </div>
        <FeedPostCommentsPanel
          postId={post.id}
          viewerRole={viewerRole}
          initialCommentCount={post.commentCount ?? 0}
          detailHref={getContentDetailHref(post)}
          guestMode={guestMode}
        />
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <span>{getRelativeFeedDate(post.createdAt)}</span>
            <span>Preview only in Feed</span>
          </div>
          <Link href={getContentDetailHref(post)} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
            {post.contentType === "newsStory" ? "Read Story" : "View Post"}
          </Link>
        </div>
      </div>
    </section>
  );
}

function renderPollPreview(poll: PollSummary) {
  return <FeedPollCard poll={poll} />;
}

function renderPetitionPreview(petition: FeedPetitionPreview, viewerUserId?: string) {
  const guestMode = isGuestUserId(viewerUserId);
  const progressPercent = getPetitionProgressPercent(petition);
  const petitionTheme = getContentTypeTheme("Petition");

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${petitionTheme.badge}`}>
          Petition
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatFeedDate(petition.createdAt)}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{petition.jurisdictionName}</span>
      </div>
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <span className="font-semibold text-ink">{petition.creatorName}</span>
          <span>{petition.status.replaceAll("_", " ")}</span>
        </div>
        <h2 className="text-xl font-semibold text-ink">{petition.title}</h2>
        <p className="text-base leading-7 text-slate-700">{getPetitionPreviewText(petition)}</p>
        {petition.issueTags?.length ? (
          <div className="flex flex-wrap gap-2">
            {petition.issueTags.map((tag) => (
              <Link
                key={`${petition.id}-${tag}`}
                href={`/issues/${slugifyIssueText(tag)}`}
                className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700 transition hover:text-civic-900"
              >
                {tag}
              </Link>
            ))}
          </div>
        ) : null}
        <div className="space-y-2 rounded-2xl bg-slate-50/80 p-4">
          <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
            <span>
              {petition.signatureCount} supporters
            </span>
            <span>{petition.signatureGoal} goal</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(progressPercent, petition.signatureCount > 0 ? 4 : 0)}%` }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">{progressPercent}% of goal</p>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <span>{getRelativeFeedDate(petition.createdAt)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FeedPetitionSupportButton
              petitionId={petition.id}
              initialCount={petition.signatureCount}
              initiallySupported={petition.viewerHasSigned}
              canSupport={petition.viewerCanSign}
              guestMode={guestMode}
            />
            <Link href={`/petitions/${petition.id}`} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
              View
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function renderDebatePreview(debate: DebateFeedPreview) {
  const debateTheme = getContentTypeTheme("Debate");

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${debateTheme.badge}`}>
          Debate
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatFeedDate(debate.createdAt)}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{debate.jurisdictionName}</span>
      </div>
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {debate.issueText ? (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${debateTheme.subtle}`}>{debate.issueText}</span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {debate.participantCount} participants
          </span>
        </div>
        <h2 className="text-xl font-semibold text-ink">{debate.title}</h2>
        <p className="text-base leading-7 text-slate-700">{getDebatePreviewText(debate)}</p>
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <span>{getRelativeFeedDate(debate.createdAt)}</span>
            <span>Compact debate preview</span>
          </div>
          <Link href={`/debates/${debate.id}`} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
            View Debate
          </Link>
        </div>
      </div>
    </section>
  );
}

function renderMediaPreview(mediaItem: MediaFeedPreview, viewerUserId?: string) {
  const guestMode = isGuestUserId(viewerUserId);
  const newsTheme = getContentTypeTheme("News Story");

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${newsTheme.badge}`}>
          News Story
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatFeedDate(mediaItem.createdAt)}</span>
        {mediaItem.biasLabel ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            User-rated bias · {mediaItem.biasLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <span className="font-semibold text-ink">{mediaItem.sourceName}</span>
          <span>{mediaItem.jurisdictionName}</span>
        </div>
        <h2 className="text-xl font-semibold text-ink">{mediaItem.title}</h2>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {getRelativeFeedDate(mediaItem.createdAt)}
          </span>
          {mediaItem.thumbnailUrl ? (
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Thumbnail available</span>
          ) : null}
        </div>
        <FeedSentimentControls
          postId={mediaItem.id}
          initialUp={mediaItem.reactionTotals.up}
          initialDown={mediaItem.reactionTotals.down}
          initialSelection={mediaItem.viewerReaction}
          canReact={!guestMode}
        />
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-500">Source-led preview with lightweight feed rendering.</p>
          <Link href={getNewsStoryHref(mediaItem.id)} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
            Read
          </Link>
        </div>
      </div>
    </section>
  );
}

function renderEventPreview(event: FeedEventPreview) {
  const eventTheme = getContentTypeTheme("Event");

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${eventTheme.badge}`}>Event</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatFeedDate(event.startsAt)}</span>
      </div>
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <span className="font-semibold text-ink">{getCommunityEventTypeLabel(event.eventType)}</span>
          <span>{event.jurisdictionName}</span>
          {event.locationLabel ? <span>{event.locationLabel}</span> : <span>Location to be announced</span>}
        </div>
        <h2 className="text-xl font-semibold text-ink">{event.title}</h2>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${eventTheme.subtle}`}>
            {event.attendingCount} attending
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {getRelativeFeedDate(event.startsAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <span>Preview only in Feed</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/events/${event.id}`} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
              Attend
            </Link>
            <Link href={`/events/${event.id}`} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
              View
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildFeedItems(input: {
  posts: PostSummary[];
  polls: PollSummary[];
  petitions: FeedPetitionPreview[];
  debates: DebateFeedPreview[];
  media: MediaFeedPreview[];
  events: FeedEventPreview[];
  localJurisdiction: string;
  viewerRole: UserRole;
  viewerUserId?: string;
  returnPath: string;
}) {
  const allItems = [
    ...input.posts.map((post) => ({
      id: `post-${post.id}`,
      type: "post" as const,
      scope: getItemScope(post.jurisdictionName, input.localJurisdiction),
      jurisdictionName: post.jurisdictionName,
      createdAt: post.createdAt,
      preview: renderPostPreview(post, input.viewerRole, input.returnPath, input.viewerUserId),
    })),
    ...input.polls.map((poll) => ({
      id: `poll-${poll.id}`,
      type: "poll" as const,
      scope: poll.scope,
      jurisdictionName: poll.jurisdictionName,
      createdAt: poll.createdAt,
      preview: renderPollPreview(poll),
    })),
    ...input.petitions.map((petition) => ({
      id: `petition-${petition.id}`,
      type: "petition" as const,
      scope: getItemScope(petition.jurisdictionName, input.localJurisdiction),
      jurisdictionName: petition.jurisdictionName,
      createdAt: petition.createdAt,
      preview: renderPetitionPreview(petition, input.viewerUserId),
    })),
    ...input.debates.map((debate) => ({
      id: `debate-${debate.id}`,
      type: "debate" as const,
      scope: getItemScope(debate.jurisdictionName, input.localJurisdiction),
      jurisdictionName: debate.jurisdictionName,
      createdAt: debate.createdAt,
      preview: renderDebatePreview(debate),
    })),
    ...input.media.map((mediaItem) => ({
      id: `media-${mediaItem.id}`,
      type: "media" as const,
      scope: getItemScope(mediaItem.jurisdictionName, input.localJurisdiction),
      jurisdictionName: mediaItem.jurisdictionName,
      createdAt: mediaItem.createdAt,
      preview: renderMediaPreview(mediaItem, input.viewerUserId),
    })),
    ...input.events.map((event) => ({
      id: `event-${event.id}`,
      type: "event" as const,
      scope: getItemScope(event.jurisdictionName, input.localJurisdiction),
      jurisdictionName: event.jurisdictionName,
      createdAt: event.startsAt,
      preview: renderEventPreview(event),
    })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) satisfies FeedPreviewItem[];

  const cappedItems = allItems.slice(0, 14);
  const newestPetition = allItems.find((item) => item.type === "petition");

  if (newestPetition && !cappedItems.some((item) => item.type === "petition")) {
    return [...cappedItems.slice(0, Math.max(cappedItems.length - 1, 0)), newestPetition];
  }

  return cappedItems;
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const returnPath = buildFeedReturnPath(params);
  const scopes = normalizeScopes(params?.scope);
  const types = normalizeTypes(params?.type);
  const view = normalizeView(params?.view);
  const briefCadence = normalizeBriefCadence(params?.brief);
  const primaryScope = scopes.includes("all") ? "all" : scopes[0] ?? "all";
  const { user, usedFallback: userFallback } = await getSafeCurrentUser();
  const queryScope: FeedScope = "all";
  const [
    { posts, usedFallback: postsFallback },
    { polls, usedFallback: pollsFallback },
    { petitions, usedFallback: petitionsFallback },
    { debates, usedFallback: debatesFallback },
    { media, usedFallback: mediaFallback },
    { events, usedFallback: eventsFallback },
  ] = await Promise.all([
    getSafeFeedPosts(view, queryScope, user.jurisdictionName, user.id),
    getSafeFeedPolls(queryScope, user.jurisdictionName, user.id),
    getSafeFeedPetitions(queryScope, user.jurisdictionName, user),
    getSafeFeedDebates(queryScope, user.jurisdictionName),
    getSafeFeedMedia(queryScope, user.jurisdictionName, user.id),
    getSafeFeedEvents(queryScope, user.jurisdictionName),
  ]);
  const feedItems = buildFeedItems({
    posts,
    polls,
    petitions,
    debates,
    media,
    events,
    localJurisdiction: user.jurisdictionName,
    viewerRole: user.role,
    viewerUserId: user.id,
    returnPath,
  });

  const modeTabs = [
    { label: "For You", href: buildFeedHref(params, { scope: primaryScope, view: "forYou" }), active: view === "forYou" },
    { label: "Most Reliable", href: buildFeedHref(params, { scope: primaryScope, view: "reliable" }), active: view === "reliable" },
    { label: "Most Discussed", href: buildFeedHref(params, { scope: primaryScope, view: "discussed" }), active: view === "discussed" },
  ];
  const civicBrief = await getCivicBrief({
    viewer: user,
    posts,
    petitions,
    debates,
    media,
    events,
    cadence: briefCadence,
  }).catch((error) => {
    console.error("[feed] civic brief failed", error);
    return null;
  });
  const briefCadenceLinks = [
    { label: "Daily", href: buildFeedHref(params, { brief: "daily" }), active: briefCadence === "daily" },
    { label: "Weekly", href: buildFeedHref(params, { brief: "weekly" }), active: briefCadence === "weekly" },
    { label: "Monthly", href: buildFeedHref(params, { brief: "monthly" }), active: briefCadence === "monthly" },
  ];
  const featuredIssue =
    posts.find((post) => post.issueTags?.length)?.issueTags?.[0] ??
    petitions.find((petition) => petition.issueTags?.length)?.issueTags?.[0] ??
    debates.find((debate) => debate.issueText)?.issueText ??
    null;
  const nextLowFrictionAction = polls[0]
    ? "Vote on one public question"
    : petitions[0]
      ? "Open one petition"
      : events[0]
        ? "Check the next civic event"
        : "Read the short civic brief";

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Feed"
        title="What changed in your world"
        description="Start with the clearest civic changes around you, see why they matter, and take one simple next step before diving deeper."
        actions={<FilterTabs tabs={modeTabs} />}
      />
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Start here</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">A simpler way to read the civic feed</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Treat this as a running answer to three questions: what changed, why it matters, and what you can do next. The deeper post threads, debates,
              evidence, and case history stay available after that first layer.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">What changed</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {feedItems.length ? `${feedItems.length} current civic updates are surfaced across posts, polls, events, petitions, and public responses.` : "This feed will fill in as civic activity is posted."}
                </p>
              </div>
              <div className="rounded-2xl bg-civic-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Why it matters</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {featuredIssue ? `${featuredIssue} is one of the clearest issue threads running through the current feed.` : "The short civic brief below pulls the most useful context to the top so you do not have to decode everything yourself."}
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Do this next</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{nextLowFrictionAction}. Then come back here to see who responded and what moved.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Participation ladder</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink">Move from casual to deeper engagement</h2>
            <div className="mt-4 space-y-2">
              {["Read the brief", "Vote on one public decision", "See both sides on one issue", "Follow an issue", "Open the related cases"].map((step) => (
                <div key={step} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {step}
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/take-action"
                className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Take one action
              </Link>
              {featuredIssue ? (
                <Link
                  href={`/issues/${slugifyIssueText(featuredIssue)}`}
                  className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                >
                  Read the short issue explainer
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      {userFallback || postsFallback || pollsFallback || petitionsFallback || debatesFallback || mediaFallback || eventsFallback ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          Some feed sections loaded with fallback data so the page could stay responsive.
        </section>
      ) : null}

      {civicBrief ? <CivicBriefPanel brief={civicBrief} cadenceLinks={briefCadenceLinks} /> : null}

      {params?.comment === "success" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your commentary was added.
        </section>
      ) : null}
      {params?.commentError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {params.commentError === "denied" && "Only trusted citizens, candidates, and officials can comment on posts."}
          {params.commentError === "short" && "Comments should be at least 8 characters."}
          {params.commentError === "long" && "Comments should stay under 280 characters."}
          {params.commentError === "limit" && "You have reached the comment limit for this post."}
          {params.commentError === "invalid" && "That comment could not be posted. Please try again."}
        </section>
      ) : null}
      {params?.truth === "saved" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your community-rated accuracy response was saved.
        </section>
      ) : null}
      {params?.truthError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {params.truthError === "denied" && "Only trusted citizens, candidates, and officials can submit truth ratings."}
          {params.truthError === "invalid" && "That truth rating could not be saved. Please try again."}
        </section>
      ) : null}
      {params?.claimFlag ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          {params.claimFlag === "saved" && "Your factual-claim flag was recorded."}
          {params.claimFlag === "already" && "You already flagged this post as containing a factual claim."}
          {params.claimFlag === "reclassified" && "Trusted-citizen flags reached the threshold. This post is now treated as a Statement / Claim."}
        </section>
      ) : null}
      {params?.claimFlagError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {params.claimFlagError === "denied" && "Only trusted citizens can flag a post as containing a factual claim."}
          {params.claimFlagError === "invalid" && "That flag could not be recorded. Please try again."}
        </section>
      ) : null}
      {params?.event ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          {params.event === "post-created" && "Your event post is now live in the feed."}
          {params.event === "rsvp-saved" && "Your RSVP was saved."}
          {params.event === "attendance-confirmed" && "Your attendance was confirmed."}
          {params.event === "sentiment-saved" && "Your attendee sentiment was recorded."}
        </section>
      ) : null}
      {params?.eventError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {params.eventError === "attendance" && "Attendance could not be confirmed yet."}
          {params.eventError === "posting" && "Only confirmed attendees can publish event posts during the event window."}
          {params.eventError === "sentiment" && "Only confirmed attendees can submit attendee sentiment for this event."}
          {params.eventError === "content" && "Event posts need a little more detail before they can be published."}
          {params.eventError === "invalid" && "That event action could not be completed."}
        </section>
      ) : null}

      {feedItems.length ? (
        <FeedFilterList
          initialScope={scopes}
          initialType={types}
          initialCommunity={params?.community}
          items={feedItems.map((item) => ({
            id: item.id,
            type: item.type,
            scope: item.scope,
            jurisdictionName: item.jurisdictionName,
          }))}
        >
          {feedItems.map((item) => item.preview)}
        </FeedFilterList>
      ) : (
        <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 shadow-card">
          No items yet. Try another scope or check back after more civic activity is posted.
        </section>
      )}

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Go deeper</h2>
        <p className="mt-2 text-sm text-slate-600">
          When you want the heavier civic layers, each content type still has a dedicated page for full detail, debate, evidence, and structured interaction.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/posts" className="text-sm font-semibold text-civic-700 hover:text-civic-900">
            Open posts
          </Link>
          <Link href="/polls" className="text-sm font-semibold text-civic-700 hover:text-civic-900">
            Open polls
          </Link>
          <Link href="/petitions" className="text-sm font-semibold text-civic-700 hover:text-civic-900">
            Open petitions
          </Link>
          <Link href="/debates" className="text-sm font-semibold text-civic-700 hover:text-civic-900">
            Open debates
          </Link>
          <Link href="/events" className="text-sm font-semibold text-civic-700 hover:text-civic-900">
            Open events
          </Link>
        </div>
      </section>
    </div>
  );
}
