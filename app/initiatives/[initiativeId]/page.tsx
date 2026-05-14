import { notFound } from "next/navigation";

import { PostCard } from "@/components/domain/post-card";
import { SentimentHistoryChart } from "@/components/domain/sentiment-history-chart";
import { PageIntro } from "@/components/ui/page-intro";
import { getDefaultSeedUser } from "@/lib/auth/mock-users";
import { buildSentimentHistory } from "@/lib/sentiment/history";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getBallotInitiativeById, getBallotInitiativeRelatedIssues, getBallotInitiativeRelatedPosts } from "@/lib/elections/initiatives";

type BallotInitiativePageProps = {
  params: Promise<{
    initiativeId: string;
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

async function withOptionalSection<T>(promise: Promise<T>, label: string, fallback: T, timeoutMs = 1800): Promise<T> {
  try {
    return await withSectionTimeout(promise, label, timeoutMs);
  } catch (error) {
    console.warn(`[initiative-detail] ${label} fallback`, error);
    return fallback;
  }
}

async function withOptionalSectionState<T>(promise: Promise<T>, label: string, fallback: T, timeoutMs = 1800) {
  try {
    return {
      data: await withSectionTimeout(promise, label, timeoutMs),
      didFallback: false,
    };
  } catch (error) {
    console.warn(`[initiative-detail] ${label} fallback`, error);
    return {
      data: fallback,
      didFallback: true,
    };
  }
}

export default async function BallotInitiativePage({ params }: BallotInitiativePageProps) {
  const { initiativeId } = await params;
  const initiative = getBallotInitiativeById(initiativeId);

  if (!initiative) {
    notFound();
  }

  const supportHistory = buildSentimentHistory(`initiative-support-${initiative.id}`, initiative.communitySentiment.support, {
    points: 8,
    opposeBias: Math.max(14, initiative.communitySentiment.oppose - 10),
  });

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Ballot Initiative"
        title={initiative.title}
        description={`${initiative.jurisdictionName} · ${initiative.scope === "local" ? "Local initiative" : "State initiative"}`}
        meta={
          <>
            <span className="rounded-full border border-cyan-300/18 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
              {initiative.scope === "local" ? "Local initiative" : "State initiative"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-200">
              {initiative.jurisdictionName}
            </span>
          </>
        }
      />
      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Summary</h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">{initiative.summary}</p>
        {initiative.officialLanguage ? (
          <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Official language</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">{initiative.officialLanguage}</p>
          </div>
        ) : null}
        <div className="mt-6">
          <SentimentHistoryChart
            data={supportHistory}
            title="Sentiment over time"
            currentValue={initiative.communitySentiment.support}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[1.75rem] border border-emerald-300/16 bg-[linear-gradient(160deg,rgba(6,78,59,0.24),rgba(8,15,28,0.94))] p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-200/85">Community sentiment</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-50">{initiative.communitySentiment.support}% support</p>
        </div>
        <div className="rounded-[1.75rem] border border-rose-300/16 bg-[linear-gradient(160deg,rgba(136,19,55,0.22),rgba(8,15,28,0.94))] p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-rose-200/85">Community sentiment</p>
          <p className="mt-2 text-3xl font-semibold text-rose-50">{initiative.communitySentiment.oppose}% oppose</p>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.82),rgba(8,15,28,0.96))] p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Community sentiment</p>
          <p className="mt-2 text-3xl font-semibold text-slate-50">{initiative.communitySentiment.unclear}% unclear</p>
        </div>
      </section>

      <RelatedIssuesSection initiativeId={initiative.id} initiativeRelatedIssues={initiative.relatedIssues} />

      <RelatedDiscussionsSection initiativeId={initiative.id} />
    </div>
  );
}

async function RelatedIssuesSection({
  initiativeId,
  initiativeRelatedIssues,
}: {
  initiativeId: string;
  initiativeRelatedIssues: string[];
}) {
  const relatedIssues = await withOptionalSection(getBallotInitiativeRelatedIssues(initiativeId), "initiative related issues", [], 1400);
  const issuesToRender = Array.from(
    new Set(relatedIssues.length ? relatedIssues.map((issue) => issue.issueText).filter(Boolean) : initiativeRelatedIssues.filter(Boolean)),
  );

  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Related issues</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {issuesToRender.map((issue, index) => (
          <span key={`${issue}-${index}`} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-200">
            {issue}
          </span>
        ))}
      </div>
    </section>
  );
}

async function RelatedDiscussionsSection({
  initiativeId,
}: {
  initiativeId: string;
}) {
  const currentUser = await withOptionalSection(getCurrentUser(), "initiative current user", getDefaultSeedUser(), 1200);
  const relatedPostsResult = await withOptionalSectionState(getBallotInitiativeRelatedPosts(initiativeId), "initiative related posts", [], 1600);
  const relatedPosts = relatedPostsResult.data;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Related discussions</h2>
        <p className="mt-2 text-sm text-slate-400">Relevant platform posts and community conversation tied to this measure.</p>
      </div>
      <div className="space-y-4">
        {relatedPosts.length ? (
          relatedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              viewerRole={currentUser.role}
              viewerUserId={currentUser.id}
              returnPath={`/initiatives/${initiativeId}`}
            />
          ))
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400 shadow-card">
            {relatedPostsResult.didFallback
              ? "Related discussions are taking longer than expected. You can still review the initiative details."
              : "No related discussions are seeded for this initiative yet."}
          </div>
        )}
      </div>
    </section>
  );
}
