import Link from "next/link";

import { PollCard } from "@/components/domain/poll-card";
import { PageIntro } from "@/components/ui/page-intro";
import { canUserCreatePoll } from "@/lib/server/auth-guards";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityById, getDefaultCommunityForUser } from "@/lib/community/communities";
import { getPollsForCommunity } from "@/lib/polls/store";

type PollsPageProps = {
  searchParams?: Promise<{
    denied?: string;
    created?: string;
    pollVote?: string;
    pollError?: string;
    communityId?: string;
    pollPromotion?: string;
    pollPromotionError?: string;
  }>;
};

export default async function PollsPage({ searchParams }: PollsPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const canCreate = await canUserCreatePoll(user);
  const defaultCommunity = getDefaultCommunityForUser(user);
  const selectedCommunity = getCommunityById(params?.communityId) ?? defaultCommunity;
  const polls = await getPollsForCommunity(user.id, selectedCommunity.id, 12);
  const returnPath = `/polls?communityId=${selectedCommunity.id}`;

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Polls"
        title="Polls surface the early public pulse"
        description="Polls stay lightweight by design. They help communities test sentiment, discover issue momentum, and identify which questions deserve to graduate into formal votes."
        meta={<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{selectedCommunity.name}</span>}
        actions={
          canCreate ? (
            <Link
              href="/polls/create"
              className="inline-flex rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700"
            >
              Start poll
            </Link>
          ) : null
        }
      />

      {params?.denied === "create-poll" ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          Your current role cannot create citizen polls.
        </section>
      ) : null}
      {params?.created === "success" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your poll is live and now appears in the citizen poll stream.
        </section>
      ) : null}
      {params?.pollVote === "success" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your poll vote was recorded.
        </section>
      ) : null}
      {params?.pollVote === "already" ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          You have already voted on that poll.
        </section>
      ) : null}
      {params?.pollError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          That poll action could not be completed. Please try again.
        </section>
      ) : null}
      {params?.pollPromotion ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          {params.pollPromotion === "petition" && "This poll was converted into a petition and remains visible as an original poll."}
          {params.pollPromotion === "system-vote" && "This poll was promoted into a formal vote and remains visible as an original poll."}
          {params.pollPromotion === "already-petition" && "This poll has already been converted into a petition."}
          {params.pollPromotion === "already-system-vote" && "This poll has already been promoted into a formal vote."}
        </section>
      ) : null}
      {params?.pollPromotionError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {params.pollPromotionError === "permissions" && "Only trusted citizens can promote a poll into a petition or formal vote."}
          {params.pollPromotionError === "threshold" && "This poll needs more engagement before it can be promoted."}
          {params.pollPromotionError === "confirm" && "Please confirm the conversion before promoting the poll."}
          {params.pollPromotionError === "duplicate-vote" && "A similar formal vote already exists for this jurisdiction."}
          {["title", "summary", "body", "question", "category", "poll"].includes(params.pollPromotionError) &&
            "That promotion could not be completed. Please review the form and try again."}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        {polls.length ? (
          polls.map((poll) => <PollCard key={poll.id} poll={poll} returnPath={returnPath} viewerRole={user.role} />)
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 shadow-card xl:col-span-2">
            No polls are active for this community yet.
          </div>
        )}
      </section>
    </div>
  );
}
