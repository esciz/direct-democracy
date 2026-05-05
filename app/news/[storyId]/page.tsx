import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PostCommentsSection } from "@/components/domain/post-comments-section";
import { PostMedia } from "@/components/domain/post-media";
import { RoleBadge } from "@/components/domain/role-badge";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import { TruthMeter } from "@/components/domain/truth-meter";
import { PageIntro } from "@/components/ui/page-intro";
import { isGuestUserId } from "@/lib/auth/session";
import { getCurrentFeedViewer } from "@/lib/server/auth-session";
import { getCommentsForPost } from "@/lib/feed/comments";
import { getTruthAiSummary } from "@/lib/explanations/ratings";
import { slugifyIssueText } from "@/lib/issues/utils";
import { getMediaBiasSummary, getMediaTierLabel } from "@/lib/media/store";
import { getNewsStoryById } from "@/lib/server/news";
import { getRawTruthMeter, getTruthBadgeFromMeter } from "@/lib/truth/ratings";
import type { PostSummary, UserRole } from "@/types/domain";

type NewsDetailPageProps = {
  params: Promise<{
    storyId: string;
  }>;
  searchParams?: Promise<{
    comment?: string;
    commentError?: string;
    truth?: string;
    truthError?: string;
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

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function NewsDetailPage({ params, searchParams }: NewsDetailPageProps) {
  const [{ storyId }, query] = await Promise.all([params, searchParams ? searchParams : Promise.resolve(undefined)]);
  let viewerId: string | undefined;

  try {
    const viewer = await withSectionTimeout(getCurrentFeedViewer(), "news viewer lookup", 1200);
    viewerId = viewer.id;
  } catch (error) {
    console.error(`[news-detail] viewer lookup failed for ${storyId}`, error);
  }

  const story = await getNewsStoryById(storyId, viewerId);

  if (!story) {
    notFound();
  }

  const returnPath = `/news/${story.id}`;
  const guestMode = isGuestUserId(viewerId);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="News Story"
        title={story.title?.trim() || "News story"}
        description="Read the full seeded story context, source information, and community-rated accuracy in one place."
        actions={
          <Link
            href="/feed"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to Feed
          </Link>
        }
      />

      {query?.comment === "success" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your commentary was added.
        </section>
      ) : null}
      {query?.commentError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {query.commentError === "denied" && "Only trusted citizens, candidates, and officials can comment on news stories."}
          {query.commentError === "short" && "Comments should be at least 8 characters."}
          {query.commentError === "long" && "Comments should stay under 280 characters."}
          {query.commentError === "limit" && "You have reached the comment limit for this story."}
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
          {query.truthError === "denied" && "Only trusted citizens can submit truth ratings for news stories."}
          {query.truthError === "invalid" && "That truth rating could not be saved. Please try again."}
        </section>
      ) : null}

      <article className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={story.authorRole} />
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
              News Story
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{story.authorName}</span>
            {story.authorMediaTier ? (
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                {getMediaTierLabel(story.authorMediaTier)}
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{story.jurisdictionName}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatTimestamp(story.createdAt)}</span>
          </div>
          <ShareActionMenu
            target={{
              entityType: "newsStory",
              entityId: story.id,
              title: story.title?.trim() || "News story",
              href: `/news/${story.id}`,
              summary: story.content?.slice(0, 160) || null,
              issueTag: story.issueTags?.[0] ?? null,
            }}
            returnPath={returnPath}
            guestMode={guestMode}
            iconOnly
          />
        </div>
        {story.title?.trim() ? <h2 className="mt-4 text-2xl font-semibold text-ink">{story.title}</h2> : null}
        {story.content?.trim() ? (
          <p className="mt-4 text-base leading-7 text-slate-700">{story.content}</p>
        ) : (
          <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Full article text is unavailable in this demo story. Source metadata and summary context are still available here.
          </div>
        )}
        {story.issueTags?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {story.issueTags.map((tag) => (
              <Link
                key={`${story.id}-${tag}`}
                href={`/issues/${slugifyIssueText(tag)}`}
                className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700 transition hover:text-civic-900"
              >
                {tag}
              </Link>
            ))}
          </div>
        ) : null}
        <PostMedia postType={story.postType} mediaUrl={story.mediaUrl} title={story.title} />
        <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-500">
          <span>{story.reactionTotals.up} support</span>
          <span>{story.reactionTotals.down} oppose</span>
        </div>
      </article>

      <Suspense fallback={<NewsSourceContextFallback />}>
        <NewsSourceContextSection story={story} />
      </Suspense>
      <Suspense fallback={<NewsTruthSectionFallback loading />}>
        <NewsTruthSection story={story} returnPath={returnPath} />
      </Suspense>
      <Suspense fallback={<NewsCommentsSectionFallback />}>
        <NewsCommentsSection storyId={story.id} returnPath={returnPath} />
      </Suspense>
    </div>
  );
}

async function NewsSourceContextSection({ story }: { story: PostSummary }) {
  try {
    const mediaBiasSummary = story.authorRole === "media" && story.authorId ? await getMediaBiasSummary(story.authorId) : null;

    return (
      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Source Context</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">About this story source</h2>
            <p className="mt-2 text-sm text-slate-600">
              Seeded news stories load with source and community context first, even when richer article fields are limited.
            </p>
          </div>
          {story.authorId && story.authorRole === "media" ? (
            <Link
              href={`/media/${story.authorId}`}
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              View source profile
            </Link>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{story.authorName}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{story.jurisdictionName}</span>
          {story.authorMediaTier ? (
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              {getMediaTierLabel(story.authorMediaTier)}
            </span>
          ) : null}
          {mediaBiasSummary?.label ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              User-rated bias · {mediaBiasSummary.label}
            </span>
          ) : null}
        </div>
      </section>
    );
  } catch (error) {
    console.error(`[news-detail] source context failed for ${story.id}`, error);

    return <NewsSourceContextFallback failed />;
  }
}

async function NewsTruthSection({ story, returnPath }: { story: PostSummary; returnPath: string }) {
  try {
    const [viewer, truthMeter] = await Promise.all([
      withSectionTimeout(getCurrentFeedViewer(), "news truth viewer lookup"),
      getRawTruthMeter(story.id),
    ]);
    const truthBadge = getTruthBadgeFromMeter(truthMeter);
    const truthAiSummary = getTruthAiSummary(story, truthMeter);

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
            {truthMeter.totalRatings} rating{truthMeter.totalRatings === 1 ? "" : "s"}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Trusted citizens can rate
          </span>
        </div>
        <TruthMeter meter={truthMeter} viewerRole={viewer.role} returnPath={returnPath} trustedCitizensOnly aiSummary={truthAiSummary} />
      </section>
    );
  } catch (error) {
    console.error(`[news-detail] truth section failed for ${story.id}`, error);

    return <NewsTruthSectionFallback />;
  }
}

async function NewsCommentsSection({ storyId, returnPath }: { storyId: string; returnPath: string }) {
  try {
    const comments = await withSectionTimeout(getCommentsForPost(storyId), "news comments lookup");
    let viewerRole: UserRole = "citizen";
    let viewerUserId: string | undefined;

    try {
      const viewer = await withSectionTimeout(getCurrentFeedViewer(), "news comments viewer lookup", 1200);
      viewerRole = viewer.role;
      viewerUserId = viewer.id;
    } catch (viewerError) {
      console.error(`[news-detail] comments viewer fallback for ${storyId}`, viewerError);
    }

    return (
      <div id="comments">
        <PostCommentsSection
          postId={storyId}
          comments={comments}
          viewerRole={viewerRole}
          viewerUserId={viewerUserId}
          returnPath={`${returnPath}#comments`}
        />
      </div>
    );
  } catch (error) {
    console.error(`[news-detail] comments failed for ${storyId}`, error);
    return <NewsCommentsSectionFallback failed />;
  }
}

function NewsSourceContextFallback({ failed = false }: { failed?: boolean }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-card">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Source Context</p>
      <p className="mt-3 text-sm text-slate-600">
        {failed ? "Source context is temporarily unavailable, but the article content still loaded." : "Loading source context..."}
      </p>
    </section>
  );
}

function NewsTruthSectionFallback({ loading = false }: { loading?: boolean }) {
  return (
    <section id="truth" className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-card">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Truth</p>
      <p className="mt-3 text-sm font-semibold text-slate-900">
        {loading ? "Loading truth details..." : "Truth details are temporarily unavailable."}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        {loading
          ? "Community-rated accuracy details will appear here when they finish loading."
          : "The story loaded successfully, but the truth section could not be rendered right now."}
      </p>
    </section>
  );
}

function NewsCommentsSectionFallback({ failed = false }: { failed?: boolean }) {
  return (
    <section id="comments" className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-card">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Comments</p>
      <p className="mt-3 text-sm font-semibold text-slate-900">
        {failed ? "Comments are temporarily unavailable." : "Loading comments..."}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        {failed
          ? "The story is still available, but the comment section could not be loaded right now."
          : "Community commentary is loading for this story."}
      </p>
    </section>
  );
}
