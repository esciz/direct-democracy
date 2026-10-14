import { AiSummaryPanel } from "@/components/domain/ai-summary-panel";
import { ExternalLinksRow } from "@/components/domain/external-links-row";
import { ExplanationPanel } from "@/components/domain/explanation-panel";
import { notFound } from "next/navigation";

import { PostCard } from "@/components/domain/post-card";
import { RoleBadge } from "@/components/domain/role-badge";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getBiasAiSummary } from "@/lib/explanations/ratings";
import { submitMediaBiasRating } from "@/lib/media/actions";
import { MEDIA_BIAS_VALUES, getMediaProfileByUserId, getMediaTierLabel } from "@/lib/media/store";
import { getFeedPosts } from "@/lib/feed/posts";
import { getUserProfileContent } from "@/lib/profile/details";
import { mergeExternalLinksWithWebsite } from "@/lib/profile/external-links";

type MediaProfilePageProps = {
  params: Promise<{
    userId: string;
  }>;
  searchParams?: Promise<{
    mediaBias?: string;
    mediaBiasError?: string;
  }>;
};

export default async function MediaProfilePage({ params, searchParams }: MediaProfilePageProps) {
  const { userId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const viewer = await getCurrentUser();
  const profile = await getMediaProfileByUserId(userId, viewer.id);

  if (!profile) {
    notFound();
  }

  const posts = (await getFeedPosts("forYou", viewer.id)).filter((post) => post.authorId === profile.userId && post.contentType === "newsStory");
  const biasAiSummary = getBiasAiSummary(profile.name, profile.biasSummary);
  const externalLinks = await getUserProfileContent(profile.userId)
    .then((content) => mergeExternalLinksWithWebsite(content.externalLinks, profile.websiteUrl))
    .catch((error) => {
      console.error(`[media-profile] external links fallback for ${profile.userId}`, error);
      return mergeExternalLinksWithWebsite([], profile.websiteUrl);
    });

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Media"
        title={profile.name}
        description="News coverage appears in the civic feed, but media outlets remain separate from official voices. Bias is shown as user-generated community feedback, not an official classification."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role="media" />
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
              {getMediaTierLabel(profile.tier)}
            </span>
          </div>
        }
      />

      {resolvedSearchParams?.mediaBias === "saved" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your bias rating was saved.
        </section>
      ) : null}
      {resolvedSearchParams?.mediaBiasError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {resolvedSearchParams.mediaBiasError === "denied"
            ? "Only verified users can rate media bias."
            : "That bias rating could not be saved."}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
              {profile.jurisdictionName}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
              {profile.followerCount.toLocaleString("en-US")} followers
            </span>
          </div>
          {profile.bio ? <p className="mt-4 text-sm leading-7 text-slate-600">{profile.bio}</p> : null}
          {externalLinks.length ? (
            <div className="mt-4">
              <ExternalLinksRow links={externalLinks} title="Public Presence" compact />
            </div>
          ) : null}
        </div>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">User-rated bias</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
            {profile.biasSummary.label ?? "Not enough ratings yet"}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Based on community ratings. This is user-generated feedback and not an official classification.
          </p>
          <div className="mt-4 space-y-3">
            {profile.biasSummary.distribution.map((entry) => (
              <div key={entry.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <span>{entry.label}</span>
                  <span>{entry.percentage}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-civic-500" style={{ width: `${entry.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>

          <form action={submitMediaBiasRating} className="mt-6 space-y-3">
            <input type="hidden" name="mediaUserId" value={profile.userId} />
            <input type="hidden" name="returnPath" value={`/media/${profile.userId}`} />
            <label htmlFor="rating" className="text-sm font-semibold text-ink">
              Rate perceived bias
            </label>
            <select
              id="rating"
              name="rating"
              defaultValue={profile.biasSummary.viewerRating ?? "Center"}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
            >
              {MEDIA_BIAS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700"
            >
              Save bias rating
            </button>
          </form>

          <div className="mt-6 space-y-4">
            <ExplanationPanel
              title="Bias Ratings explained"
              summary="Bias ratings are user-generated and describe perceived framing, emphasis, and viewpoint."
              compact
            >
              <p>
                The scale runs from <strong>Far Left</strong>, <strong>Left</strong>, and <strong>Center</strong> to <strong>Right</strong> and <strong>Far Right</strong>.
              </p>
              <p>
                Bias does not automatically mean truth or falsehood. It reflects how readers perceive the tone, framing, and perspective of the coverage.
              </p>
            </ExplanationPanel>
            <AiSummaryPanel summary={biasAiSummary.summary} bullets={biasAiSummary.bullets} compact />
          </div>
        </section>
      </section>

      <section className="space-y-4">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Recent coverage</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">News stories from this outlet</h2>
        </div>
        <div className="grid gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} viewerRole={viewer.role} viewerUserId={viewer.id} returnPath={`/media/${profile.userId}`} />
          ))}
        </div>
      </section>
    </div>
  );
}
