import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ContentReportControlServer } from "@/components/domain/content-report-control-server";
import { FactualClaimFlagAction } from "@/components/domain/factual-claim-flag-action";
import { FollowButton } from "@/components/domain/follow-button";
import { PostCommentsSection } from "@/components/domain/post-comments-section";
import { RoleBadge } from "@/components/domain/role-badge";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import { TruthIdeologyBreakdown } from "@/components/domain/truth-ideology-breakdown";
import { TruthMeter } from "@/components/domain/truth-meter";
import { PageIntro } from "@/components/ui/page-intro";
import { PostMedia } from "@/components/domain/post-media";
import { canUserFlagFactualClaim } from "@/lib/auth/guards";
import { isGuestUserId } from "@/lib/auth/session";
import { getCurrentFeedViewer } from "@/lib/server/auth-session";
import { getCommentsForPost } from "@/lib/feed/comments";
import { getPostById } from "@/lib/feed/posts";
import { getTruthAiSummary } from "@/lib/explanations/ratings";
import { slugifyIssueText } from "@/lib/issues/utils";
import { getContentDetailHref } from "@/lib/news/links";
import { getEffectivePostContentType, getPostClaimFlagState } from "@/lib/truth/claim-flags";
import { getRawTruthMeter, getTruthBadgeFromMeter, getTruthIdeologyBreakdown } from "@/lib/truth/ratings";
import type { PostSummary, UserRole } from "@/types/domain";

type PostDetailPageProps = {
  params: Promise<{
    postId: string;
  }>;
  searchParams?: Promise<{
    denied?: string;
    comment?: string;
    commentError?: string;
    truth?: string;
    truthError?: string;
    claimFlag?: string;
    claimFlagError?: string;
  }>;
};

function withSectionTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 1800): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

export default async function PostDetailPage({ params, searchParams }: PostDetailPageProps) {
  const [{ postId }, query] = await Promise.all([params, searchParams ? searchParams : Promise.resolve(undefined)]);
  const viewer = await getCurrentFeedViewer();
  const post = await getPostById(postId, viewer.id);

  if (!post) {
    notFound();
  }

  const returnPath = `/posts/${post.id}`;
  const guestMode = isGuestUserId(viewer.id);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Post Detail"
        title={post.title ?? "Post detail"}
        description="Review the full post context, community-rated accuracy, and deeper discussion here."
        actions={
          <>
            <Link
              href="/feed"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              Back to Feed
            </Link>
          </>
        }
      />
      {query?.comment === "success" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your commentary was added.
        </section>
      ) : null}
      {query?.commentError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {query.commentError === "denied" && "Only trusted citizens, candidates, and officials can comment on posts."}
          {query.commentError === "empty" && "Add a short caption, an image, or both before posting your comment."}
          {query.commentError === "short" && "Comments should be at least 8 characters."}
          {query.commentError === "long" && "Comments should stay under 280 characters."}
          {query.commentError === "limit" && "You have reached the comment limit for this post."}
          {query.commentError === "media" && "Comment images need one valid http or https URL."}
          {query.commentError === "invalid" && "That comment could not be posted. Please try again."}
        </section>
      ) : null}
      {query?.truth === "saved" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your community-rated accuracy response was saved.
        </section>
      ) : null}
      {query?.truthError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {query.truthError === "denied" && "Only trusted citizens, candidates, and officials can submit truth ratings."}
          {query.truthError === "invalid" && "That truth rating could not be saved. Please try again."}
        </section>
      ) : null}
      {query?.claimFlag ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          {query.claimFlag === "saved" && "Your factual-claim flag was recorded."}
          {query.claimFlag === "already" && "You already flagged this post as containing a factual claim."}
          {query.claimFlag === "reclassified" && "Trusted-citizen flags reached the threshold. This post is now treated as a Statement / Claim."}
        </section>
      ) : null}
      {query?.claimFlagError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {query.claimFlagError === "denied" && "Only trusted citizens can flag a post as containing a factual claim."}
          {query.claimFlagError === "invalid" && "That flag could not be recorded. Please try again."}
        </section>
      ) : null}
      <article className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {post.authorProfileHref ? (
                <Link href={post.authorProfileHref} className="text-base font-semibold text-ink hover:text-civic-700">
                  {post.authorName}
                </Link>
              ) : (
                <span className="text-base font-semibold text-ink">{post.authorName}</span>
              )}
              <RoleBadge role={post.authorRole} />
              {post.authorCredibilityLabel ? (
                <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
                  {post.authorCredibilityLabel}
                </span>
              ) : null}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{post.jurisdictionName}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {new Date(post.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {post.issueTags?.length ? (
              <div className="flex flex-wrap gap-2">
                {post.issueTags.map((tag) => (
                  <Link
                    key={`${post.id}-${tag}`}
                    href={`/issues/${slugifyIssueText(tag)}`}
                    className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700 transition hover:text-civic-900"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
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
            <ShareActionMenu
              target={{
                entityType: post.contentType === "newsStory" ? "newsStory" : "post",
                entityId: post.id,
                title: post.title?.trim() || post.content.slice(0, 80) || `${post.authorName} post`,
                href: getContentDetailHref(post),
                summary: post.content.slice(0, 160) || null,
                issueTag: post.issueTags?.[0] ?? null,
              }}
              returnPath={returnPath}
              guestMode={guestMode}
              iconOnly
            />
          </div>
        </div>
        {post.title ? <h2 className="mt-4 text-2xl font-semibold text-ink">{post.title}</h2> : null}
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
        <PostMedia postType={post.postType} mediaUrl={post.mediaUrl} title={post.title} />
        <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-500">
          <span>{post.reactionTotals.up} support</span>
          <span>{post.reactionTotals.down} oppose</span>
        </div>
      </article>
      <Suspense fallback={<PostReportSectionFallback />}>
        <PostReportSection post={post} />
      </Suspense>
      <Suspense fallback={<PostClaimFlagSectionFallback />}>
        <PostClaimFlagSection post={post} returnPath={returnPath} />
      </Suspense>
      <Suspense fallback={<PostTruthSectionFallback loading />}>
        <PostTruthSection post={post} returnPath={returnPath} />
      </Suspense>
      <Suspense fallback={<PostCommentsSectionFallback />}>
        <PostCommentsDetailSection postId={post.id} returnPath={returnPath} />
      </Suspense>
    </div>
  );
}

async function PostReportSection({ post }: { post: PostSummary }) {
  try {
    const viewer = await withSectionTimeout(getCurrentFeedViewer(), "report viewer lookup", 1200);

    return (
      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-700">Moderation</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Report inappropriate content</h2>
            <p className="mt-2 text-sm text-slate-600">
              Use this for harassment, threats, hate, spam, or other inappropriate content. This is separate from truth rating and factual-claim flagging.
            </p>
          </div>
          {!isGuestUserId(viewer.id) ? <ContentReportControlServer userId={viewer.id} targetType="post" targetId={post.id} /> : null}
        </div>
        {isGuestUserId(viewer.id) ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">
            Guest Browse is read-only. Verify to report content or take part in moderation workflows.
          </div>
        ) : null}
      </section>
    );
  } catch (error) {
    console.error(`[post-detail] report section failed for ${post.id}`, error);

    return <PostReportSectionFallback failed />;
  }
}

async function PostClaimFlagSection({
  post,
  returnPath,
}: {
  post: PostSummary;
  returnPath: string;
}) {
  try {
    const [viewer, effectiveContentType] = await Promise.all([
      withSectionTimeout(getCurrentFeedViewer(), "claim flag viewer lookup"),
      getEffectivePostContentType(post),
    ]);
    const claimFlagState = await getPostClaimFlagState(post.id, viewer.id);
    const canFlag = canUserFlagFactualClaim(viewer);
    const alreadyStatementClaim = effectiveContentType === "statementClaim";
    const alreadyNewsStory = effectiveContentType === "newsStory";

    return (
      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-700">Factual Claim</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Flag for factual review</h2>
            <p className="mt-2 text-sm text-slate-600">
              Trusted citizens can mark posts that should enter the community truth-rating workflow.
            </p>
          </div>
          {canFlag && !alreadyStatementClaim && !alreadyNewsStory && !claimFlagState.thresholdReached ? (
            <FactualClaimFlagAction postId={post.id} returnPath={returnPath} disabled={claimFlagState.viewerHasFlagged} />
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {alreadyStatementClaim ? (
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              Already treated as a factual claim
            </span>
          ) : null}
          {alreadyNewsStory ? (
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              News stories already enter truth review
            </span>
          ) : null}
          {claimFlagState.count > 0 && !claimFlagState.thresholdReached ? (
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              {claimFlagState.count} trusted-citizen flag{claimFlagState.count === 1 ? "" : "s"}
            </span>
          ) : null}
          {!canFlag && !alreadyStatementClaim && !alreadyNewsStory ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Only trusted citizens can flag
            </span>
          ) : null}
          {claimFlagState.viewerHasFlagged ? (
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              You already flagged this post
            </span>
          ) : null}
        </div>
      </section>
    );
  } catch (error) {
    console.error(`[post-detail] claim flag section failed for ${post.id}`, error);

    return <PostClaimFlagSectionFallback failed />;
  }
}

async function PostTruthSection({
  post,
  returnPath,
}: {
  post: PostSummary;
  returnPath: string;
}) {
  try {
    const effectiveContentType = await getEffectivePostContentType(post);
    const truthEligible = effectiveContentType === "statementClaim" || effectiveContentType === "newsStory";

    if (!truthEligible) {
      return (
        <section id="truth" className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-card">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Truth</p>
          <p className="mt-3 text-sm text-slate-600">Truth rating is not available for this type of post.</p>
        </section>
      );
    }

    const summaryMeter = await getRawTruthMeter(post.id);
    const truthBadge = getTruthBadgeFromMeter(summaryMeter);

    return (
      <section id="truth" className="space-y-4 rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Truth</p>
          {truthBadge ? (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                truthBadge === "Mostly Accurate"
                  ? "bg-emerald-50 text-emerald-700"
                  : truthBadge === "Misleading"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              Overall Truth: {truthBadge}
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {summaryMeter.totalRatings} rating{summaryMeter.totalRatings === 1 ? "" : "s"}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {effectiveContentType === "newsStory" ? "Trusted citizens can rate" : "Trusted roles can rate"}
          </span>
        </div>
        <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            {truthBadge
              ? "Fast truth summary loaded. Detailed explanations and rating controls are still loading below."
              : "Community truth ratings are available for this post. Detailed explanations and rating controls are still loading below."}
          </p>
          <div className="space-y-2">
            {summaryMeter.distribution.map((entry) => (
              <div key={entry.label} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
                  <span>{entry.label}</span>
                  <span>
                    {entry.count} · {entry.percentage}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white">
                  <div
                    className={`h-2 rounded-full ${
                      entry.label === "Accurate"
                        ? "bg-emerald-500"
                        : entry.label === "Mostly True"
                          ? "bg-civic-500"
                          : entry.label === "Mixed / Unclear"
                            ? "bg-slate-400"
                            : entry.label === "Misleading"
                              ? "bg-orange-500"
                              : "bg-rose-500"
                    }`}
                    style={{ width: `${Math.max(entry.percentage, entry.count ? 8 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <Suspense fallback={<PostTruthDetailsFallback />}>
          <PostTruthDetails post={post} effectiveContentType={effectiveContentType} returnPath={returnPath} />
        </Suspense>
      </section>
    );
  } catch (error) {
    console.error(`[post-detail] truth section failed for ${post.id}`, error);

    return <PostTruthSectionFallback />;
  }
}

async function PostTruthDetails({
  post,
  effectiveContentType,
  returnPath,
}: {
  post: PostSummary;
  effectiveContentType: "statementClaim" | "newsStory";
  returnPath: string;
}) {
  try {
    const viewer = await withSectionTimeout(getCurrentFeedViewer(), "truth viewer lookup");
    const [truthMeter, ideologyBreakdown] = await Promise.all([
      withSectionTimeout(getRawTruthMeter(post.id, viewer.id), "truth meter lookup"),
      getTruthIdeologyBreakdown(post.id).catch((error) => {
        console.error(`[post-detail] ideology truth breakdown failed for ${post.id}`, error);
        return [];
      }),
    ]);
    const truthAiSummary = getTruthAiSummary(post, truthMeter);

    return (
      <div className="space-y-4">
        <TruthMeter
          meter={truthMeter}
          viewerRole={viewer.role}
          returnPath={returnPath}
          trustedCitizensOnly={effectiveContentType === "newsStory"}
          aiSummary={truthAiSummary}
        />
        {ideologyBreakdown.length ? <TruthIdeologyBreakdown entries={ideologyBreakdown} /> : null}
      </div>
    );
  } catch (error) {
    console.error(`[post-detail] truth details failed for ${post.id}`, error);

    return <PostTruthDetailsFallback failed />;
  }
}

function PostTruthSectionFallback({ loading = false }: { loading?: boolean }) {
  return (
    <section id="truth" className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-card">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Truth</p>
      <p className="mt-3 text-sm font-semibold text-slate-900">
        {loading ? "Loading truth details..." : "Truth details are temporarily unavailable."}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        {loading
          ? "The post is ready. Community-rated accuracy and truth-entry controls will appear here when they finish loading."
          : "The post loaded successfully, but the truth section could not be rendered right now."}
      </p>
    </section>
  );
}

function PostClaimFlagSectionFallback({ failed = false }: { failed?: boolean }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-card">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-700">Factual Claim</p>
      <p className="mt-3 text-sm text-slate-600">
        {failed ? "Factual-claim flag controls are temporarily unavailable." : "Loading factual-claim controls..."}
      </p>
    </section>
  );
}

function PostReportSectionFallback({ failed = false }: { failed?: boolean }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-card">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-700">Moderation</p>
      <p className="mt-3 text-sm text-slate-600">
        {failed ? "Reporting controls are temporarily unavailable." : "Loading reporting controls..."}
      </p>
    </section>
  );
}

function PostTruthDetailsFallback({ failed = false }: { failed?: boolean }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">
        {failed ? "Detailed truth controls are temporarily unavailable." : "Loading truth controls..."}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        {failed
          ? "The overall truth summary is still available above, but viewer-specific truth controls and details could not be loaded right now."
          : "Viewer-specific rating controls, your prior truth rating, and the richer explanation panels will appear here when ready."}
      </p>
    </div>
  );
}

async function PostCommentsDetailSection({ postId, returnPath }: { postId: string; returnPath: string }) {
  try {
    const comments = await withSectionTimeout(getCommentsForPost(postId), "comments lookup");
    let viewerRole: UserRole = "citizen";
    let viewerUserId: string | undefined;

    try {
      const viewer = await withSectionTimeout(getCurrentFeedViewer(), "comments viewer lookup", 1200);
      viewerRole = viewer.role;
      viewerUserId = viewer.id;
    } catch (viewerError) {
      console.error(`[post-detail] comments viewer fallback for ${postId}`, viewerError);
    }

    return (
      <div id="comments">
        <PostCommentsSection
          postId={postId}
          comments={comments}
          viewerRole={viewerRole}
          viewerUserId={viewerUserId}
          returnPath={`${returnPath}#comments`}
        />
      </div>
    );
  } catch (error) {
    console.error(`[post-detail] comments failed for ${postId}`, error);
    return <PostCommentsSectionFallback failed />;
  }
}

function PostCommentsSectionFallback({ failed = false }: { failed?: boolean }) {
  return (
    <section id="comments" className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-card">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Comments</p>
      <p className="mt-3 text-sm font-semibold text-slate-900">
        {failed ? "Comments are temporarily unavailable." : "Loading comments..."}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        {failed
          ? "The post is still available, but the full comment section could not be loaded right now."
          : "Community commentary is loading for this post."}
      </p>
    </section>
  );
}
