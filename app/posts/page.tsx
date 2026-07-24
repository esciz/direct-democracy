import Link from "next/link";

import { PostFeedList } from "@/components/domain/post-feed-list";
import { PostComposerShell } from "@/components/domain/post-composer-shell";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageIntro } from "@/components/ui/page-intro";
import { canUserCreatePoll, canUserCreatePublicPost } from "@/lib/server/auth-guards";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getFeedPosts, type FeedMode } from "@/lib/feed/posts";
import { withBoundedFallback } from "@/lib/server/async-fallback";

type PostsPageProps = {
  searchParams?: Promise<{
    denied?: string;
    comment?: string;
    commentError?: string;
    truth?: string;
    truthError?: string;
    claimFlag?: string;
    claimFlagError?: string;
    view?: string;
  }>;
};

function normalizeView(value: string | undefined): FeedMode {
  if (value === "reliable" || value === "discussed") {
    return value;
  }

  return "forYou";
}

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const view = normalizeView(params?.view);
  const [canCreate, canCreatePolls, posts] = await Promise.all([
    withBoundedFallback(canUserCreatePublicPost(user), false, {
      label: "post creation permission",
      timeoutMs: 1000,
    }),
    withBoundedFallback(canUserCreatePoll(user), false, {
      label: "poll creation permission",
      timeoutMs: 1000,
    }),
    withBoundedFallback(getFeedPosts(view, user.id), [], {
      label: "post feed",
      timeoutMs: 1600,
    }),
  ]);
  const items = posts.map((post) => ({ id: `post-${post.id}`, itemType: "post" as const, post }));
  const tabs = [
    { label: "For You", href: "/posts?view=forYou", active: view === "forYou" },
    { label: "Most Reliable", href: "/posts?view=reliable", active: view === "reliable" },
    { label: "Most discussed", href: "/posts?view=discussed", active: view === "discussed" },
  ];
  const returnPath = `/posts?view=${view}`;

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Civic Briefs"
        title="Contextual perspectives"
        description="A deeper view of civic briefs from trusted citizens, candidates, officials, and media, organized as contextual perspectives rather than a random social feed."
        actions={
          <>
            <FilterTabs tabs={tabs} />
            {canCreate ? (
              <Link
                href="/posts/create"
                className="inline-flex rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700"
              >
                Create perspective
              </Link>
            ) : null}
            {canCreatePolls ? (
              <Link
                href="/polls/create"
                className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                Start poll
              </Link>
            ) : null}
          </>
        }
      />
      {params?.denied === "create-post" ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          Your current role cannot create public posts.
        </section>
      ) : null}
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
      <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-4">
          <PostComposerShell canCreate={canCreate} />
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Conversation role</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              For You balances relevance, engagement, and credibility. Most Reliable leans toward trusted voices and credible claims. Most Discussed leans toward active conversation.
            </p>
          </section>
        </div>
        <PostFeedList items={items} viewerRole={user.role} viewerUserId={user.id} returnPath={returnPath} />
      </div>
    </div>
  );
}
