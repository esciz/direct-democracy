import { notFound } from "next/navigation";

import { PostCard } from "@/components/domain/post-card";
import { PageIntro } from "@/components/ui/page-intro";
import { getDefaultSeedUser } from "@/lib/auth/mock-users";
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

export default async function BallotInitiativePage({ params }: BallotInitiativePageProps) {
  const { initiativeId } = await params;
  const initiative = getBallotInitiativeById(initiativeId);

  if (!initiative) {
    notFound();
  }

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Ballot Initiative"
        title={initiative.title}
        description={`${initiative.jurisdictionName} · ${initiative.scope === "local" ? "Local initiative" : "State initiative"}`}
      />
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Summary</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{initiative.summary}</p>
        {initiative.officialLanguage ? (
          <div className="mt-5 rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Official language</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">{initiative.officialLanguage}</p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[1.75rem] border border-white/70 bg-emerald-50 p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">Community sentiment</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-900">{initiative.communitySentiment.support}% support</p>
        </div>
        <div className="rounded-[1.75rem] border border-white/70 bg-rose-50 p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-rose-700">Community sentiment</p>
          <p className="mt-2 text-3xl font-semibold text-rose-900">{initiative.communitySentiment.oppose}% oppose</p>
        </div>
        <div className="rounded-[1.75rem] border border-white/70 bg-slate-100 p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Community sentiment</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{initiative.communitySentiment.unclear}% unclear</p>
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
  const relatedIssues = await withSectionTimeout(getBallotInitiativeRelatedIssues(initiativeId), "initiative related issues", 1400).catch((error) => {
    console.error(`[initiative-detail] related issues fallback for ${initiativeId}`, error);
    return [];
  });
  const issuesToRender = relatedIssues.length ? relatedIssues.map((issue) => issue.issueText) : initiativeRelatedIssues;

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">Related issues</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {issuesToRender.map((issue) => (
          <span key={issue} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
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
  const currentUser = await withSectionTimeout(getCurrentUser(), "initiative current user", 1200).catch((error) => {
    console.error(`[initiative-detail] current user fallback for ${initiativeId}`, error);
    return getDefaultSeedUser();
  });
  const relatedPosts = await withSectionTimeout(getBallotInitiativeRelatedPosts(initiativeId), "initiative related posts", 1600).catch((error) => {
    console.error(`[initiative-detail] related posts fallback for ${initiativeId}`, error);
    return [];
  });

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Related discussions</h2>
        <p className="mt-2 text-sm text-slate-600">Relevant platform posts and community conversation tied to this measure.</p>
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
          <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 shadow-card">
            No related discussions are seeded for this initiative yet.
          </div>
        )}
      </div>
    </section>
  );
}
