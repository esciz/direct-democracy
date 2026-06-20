import { AiSummaryPanel } from "@/components/domain/ai-summary-panel";
import { ContentReportControlServer } from "@/components/domain/content-report-control-server";
import { ExplanationPanel } from "@/components/domain/explanation-panel";
import { FactualClaimFlagAction } from "@/components/domain/factual-claim-flag-action";
import { FollowButton } from "@/components/domain/follow-button";
import Link from "next/link";

import { PostCommentsSection } from "@/components/domain/post-comments-section";
import { PostMedia } from "@/components/domain/post-media";
import { ReactionBar } from "@/components/domain/reaction-bar";
import { RoleBadge } from "@/components/domain/role-badge";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import { TruthMeter } from "@/components/domain/truth-meter";
import { canUserFlagFactualClaim } from "@/lib/auth/guards";
import { isGuestUserId } from "@/lib/auth/session";
import { getCommunityContextLabel } from "@/lib/community/communities";
import { getCommentsForPost } from "@/lib/feed/comments";
import { getMediaBiasSummary, getMediaTierLabel } from "@/lib/media/store";
import { getBiasAiSummary, getTruthAiSummary } from "@/lib/explanations/ratings";
import { slugifyIssueText } from "@/lib/issues/utils";
import { getContentDetailHref } from "@/lib/news/links";
import { getEffectivePostContentType, getPostClaimFlagState } from "@/lib/truth/claim-flags";
import { getTruthBadgeFromMeter, getTruthMeter } from "@/lib/truth/ratings";
import type { PostContentType, PostSummary, UserRole } from "@/types/domain";

type PostCardProps = {
  post: PostSummary;
  viewerRole: UserRole;
  viewerUserId?: string;
  returnPath?: string;
  truthSectionAnchorId?: string;
};

function getContentTypeMeta(contentType: PostContentType) {
  switch (contentType) {
    case "statementClaim":
      return { label: "Statement / Claim", icon: "Fact" };
    case "newsStory":
      return { label: "News Story", icon: "News" };
    case "opinionPerspective":
      return { label: "Perspective", icon: "View" };
    case "announcementUpdate":
      return { label: "Announcement / Update", icon: "Update" };
    case "event":
      return { label: "Event", icon: "Event" };
    case "questionPoll":
      return { label: "Question / Poll", icon: "Ask" };
    case "interview":
      return { label: "Citizen Interview", icon: "Interview" };
  }
}

export async function PostCard({ post, viewerRole, viewerUserId, returnPath = "/posts", truthSectionAnchorId }: PostCardProps) {
  const isGuestViewer = isGuestUserId(viewerUserId);
  const canReact = viewerRole === "citizen" && !isGuestViewer;
  const canFlagClaim = canUserFlagFactualClaim({ role: viewerRole });
  const [comments, claimFlagState] = await Promise.all([
    getCommentsForPost(post.id),
    getPostClaimFlagState(post.id, viewerUserId),
  ]);
  const mediaBiasSummary = post.authorRole === "media" && post.authorId ? await getMediaBiasSummary(post.authorId, viewerUserId) : null;
  let effectiveContentType = post.contentType;
  let truthMeter: Awaited<ReturnType<typeof getTruthMeter>> | null = null;
  let truthBadge: ReturnType<typeof getTruthBadgeFromMeter> = null;
  let truthAiSummary: ReturnType<typeof getTruthAiSummary> | null = null;

  try {
    effectiveContentType = await getEffectivePostContentType(post);
    const showTruthMeter = effectiveContentType === "statementClaim" || effectiveContentType === "newsStory";
    truthMeter = showTruthMeter ? await getTruthMeter(post.id, viewerUserId) : null;
    truthBadge = truthMeter ? getTruthBadgeFromMeter(truthMeter) : null;
    truthAiSummary = truthMeter ? getTruthAiSummary(post, truthMeter) : null;
  } catch (error) {
    console.error(`[post-card] truth context failed for ${post.id}`, error);
  }

  const contentTypeMeta = getContentTypeMeta(effectiveContentType);
  const wasReclassified = post.contentType !== "statementClaim" && effectiveContentType === "statementClaim";
  const biasAiSummary = post.authorRole === "media" && mediaBiasSummary ? getBiasAiSummary(post.authorName, mediaBiasSummary) : null;
  const communityContextLabel = getCommunityContextLabel(post.jurisdictionName);

  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {post.authorProfileHref ? (
              <Link href={post.authorProfileHref} className="text-sm font-semibold text-ink hover:text-civic-700">
                {post.authorName}
              </Link>
            ) : (
              <p className="text-sm font-semibold text-ink">{post.authorName}</p>
            )}
            <RoleBadge role={post.authorRole} />
            {post.authorCredibilityLabel ? (
              <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
                {post.authorCredibilityLabel}
              </span>
            ) : null}
            {post.authorRole === "media" && post.authorMediaTier ? (
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                {getMediaTierLabel(post.authorMediaTier)}
              </span>
            ) : null}
            {post.viewerFollowsAuthor ? (
              <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
                Following
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-500">{communityContextLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {post.authorId && post.authorViewerCanFollow && !isGuestViewer ? (
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
          <ShareActionMenu
            target={{
              entityType: post.contentType === "newsStory" ? "newsStory" : "post",
              entityId: post.id,
              title: post.title?.trim() || post.content.slice(0, 80) || `${post.authorName} perspective`,
              href: getContentDetailHref(post),
              summary: post.content.slice(0, 160) || null,
              issueTag: post.issueTags?.[0] ?? null,
            }}
            returnPath={returnPath}
            guestMode={isGuestViewer}
            iconOnly
          />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            {post.postType}
          </span>
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
            {contentTypeMeta.icon} · {contentTypeMeta.label}
          </span>
          {post.isEventPost ? (
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
              Event Post
            </span>
          ) : null}
          {post.promotedLabel ? (
            <span className="rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-700">
              {post.promotedLabel}
            </span>
          ) : null}
          {wasReclassified ? (
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
              Reclassified by trusted citizens
            </span>
          ) : null}
          {truthBadge ? (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                truthBadge === "Mostly Accurate"
                  ? "bg-emerald-50 text-emerald-700"
                  : truthBadge === "Misleading"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              Community-rated accuracy · {truthBadge}
            </span>
          ) : null}
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
            {new Date(post.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
      {post.authorRole === "media" && mediaBiasSummary ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
              User-rated bias {mediaBiasSummary.label ? `· ${mediaBiasSummary.label}` : "· Not enough ratings"}
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              {mediaBiasSummary.totalRatings} rating{mediaBiasSummary.totalRatings === 1 ? "" : "s"}
            </span>
          </div>
          <ExplanationPanel
            title="Bias Ratings explained"
            summary="Bias ratings are user-generated and reflect perceived framing or viewpoint, not whether something is true or false."
            compact
          >
            <p>
              The scale runs from <strong>Far Left</strong> and <strong>Left</strong> through <strong>Center</strong> to <strong>Right</strong> and <strong>Far Right</strong>.
            </p>
            <p>
              A bias label helps readers understand perceived framing style. It does not automatically mean a story is accurate, misleading, or false.
            </p>
          </ExplanationPanel>
          {biasAiSummary ? <AiSummaryPanel summary={biasAiSummary.summary} bullets={biasAiSummary.bullets} compact /> : null}
        </div>
      ) : null}
      {post.title ? <h2 className="mt-4 text-xl font-semibold text-ink">{post.title}</h2> : null}
      {post.isEventPost && post.eventId && post.eventTitle ? (
        <p className="mt-4 text-sm font-medium text-civic-700">
          <Link href={`/events/${post.eventId}`} className="hover:text-civic-900">
            Posted from {post.eventTitle}
          </Link>
        </p>
      ) : null}
      {post.contentType === "interview" && post.eventId && post.eventTitle ? (
        <p className="mt-4 text-sm font-medium text-civic-700">
          <Link href={`/events/${post.eventId}`} className="hover:text-civic-900">
            Interview event · {post.eventTitle}
          </Link>
        </p>
      ) : null}
      {post.content ? <p className="mt-4 text-base leading-7 text-slate-700">{post.content}</p> : null}
      {post.sharedItem ? (
        <div className="mt-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
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
      {post.issueTags?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.issueTags.slice(0, 3).map((tag) => (
            <Link
              key={`${post.id}-${tag}`}
              href={`/issues/${slugifyIssueText(tag)}`}
              className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700 transition hover:text-civic-900"
            >
              {tag}
            </Link>
          ))}
          {post.issueTags.length > 3 ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              +{post.issueTags.length - 3} more
            </span>
          ) : null}
        </div>
      ) : null}
      {post.contentType === "interview" && (post.interviewerName || post.interviewSubjectName) ? (
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
          {post.interviewerName ? (
            <span className="rounded-full bg-civic-50 px-3 py-1 text-civic-700">Interviewer · {post.interviewerName}</span>
          ) : null}
          {post.interviewSubjectName ? (
            post.interviewSubjectProfileHref ? (
              <Link
                href={post.interviewSubjectProfileHref}
                className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 transition hover:text-civic-700"
              >
                Subject · {post.interviewSubjectName}
              </Link>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Subject · {post.interviewSubjectName}</span>
            )
          ) : null}
        </div>
      ) : null}
      <PostMedia postType={post.postType} mediaUrl={post.mediaUrl} title={post.title} />
      {claimFlagState.count > 0 && !claimFlagState.thresholdReached ? (
        <div className="mt-5 rounded-[1.5rem] border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
          Community flagged as containing a factual claim. {claimFlagState.count} trusted citizen flag
          {claimFlagState.count === 1 ? "" : "s"} so far.
        </div>
      ) : null}
      {canFlagClaim && post.contentType !== "statementClaim" && post.contentType !== "newsStory" && !claimFlagState.thresholdReached ? (
        <div className="mt-4">
          <FactualClaimFlagAction postId={post.id} returnPath={returnPath} disabled={claimFlagState.viewerHasFlagged} />
        </div>
      ) : null}
      {truthMeter ? (
        <div id={truthSectionAnchorId} className="mt-5">
          <TruthMeter
            meter={truthMeter}
            viewerRole={viewerRole}
            returnPath={returnPath}
            compact
            trustedCitizensOnly={effectiveContentType === "newsStory"}
            aiSummary={truthAiSummary ?? undefined}
          />
        </div>
      ) : null}
      {canReact ? (
        <ReactionBar initialUp={post.reactionTotals.up} initialDown={post.reactionTotals.down} />
      ) : (
        <p className="mt-5 text-sm text-slate-500">Thumbs up and thumbs down remain available as a separate sentiment signal from truth ratings.</p>
      )}
      {viewerUserId && !isGuestViewer ? (
        <div className="mt-4">
          <ContentReportControlServer userId={viewerUserId} targetType="post" targetId={post.id} />
        </div>
      ) : null}
      <PostCommentsSection
        postId={post.id}
        comments={comments}
        viewerRole={viewerRole}
        viewerUserId={viewerUserId}
        returnPath={returnPath}
      />
    </article>
  );
}
