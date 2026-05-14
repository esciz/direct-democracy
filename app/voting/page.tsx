import { VotingPageSections } from "@/components/domain/voting-page-sections";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { canUserVote } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getVerificationLabel } from "@/lib/auth/verification";
import { getDefaultCommunityForUser } from "@/lib/community/communities";
import { getVotingLibrary } from "@/lib/feed/quick-votes";
import { getContextualPollPreviews } from "@/lib/polls/store";
import type { VoteObjectType } from "@/types/domain";

type VotingPageProps = {
  searchParams?: Promise<{
    filter?: string;
    voted?: string;
    voteError?: string;
  }>;
};

type VotingFilter = "all" | "people" | "issues" | "cases";

function normalizeFilter(value: string | undefined): VotingFilter {
  if (value === "people" || value === "issues" || value === "cases") {
    return value;
  }

  return "all";
}

function matchesFilter(filter: VotingFilter, objectType: VoteObjectType) {
  if (filter === "all") return true;
  if (filter === "people") return objectType === "representative";
  if (filter === "cases") return objectType === "case";
  return objectType === "decision" || objectType === "community";
}

export default async function VotingPage({ searchParams }: VotingPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const user = await getCurrentUser();
  const defaultCommunity = getDefaultCommunityForUser(user);
  const filter = normalizeFilter(params?.filter);
  const pollAttachmentMap = new Map<string, { type: "community"; id: string; label: string }>();

  pollAttachmentMap.set("united-states", { type: "community", id: "united-states", label: "United States Community" });
  pollAttachmentMap.set("nevada", { type: "community", id: "nevada", label: "Nevada Community" });
  pollAttachmentMap.set(defaultCommunity.id, { type: "community", id: defaultCommunity.id, label: defaultCommunity.name });

  if (user.studentVerified && user.studentCampusCommunityId) {
    pollAttachmentMap.set(user.studentCampusCommunityId, {
      type: "community",
      id: user.studentCampusCommunityId,
      label: "Campus Community",
    });
  }

  const [questions, citizenPolls] = await Promise.all([
    getVotingLibrary(user, { scope: "all", category: "all", objectType: "all" }).then((items) =>
      items.filter((question) => matchesFilter(filter, question.objectType ?? "decision")),
    ),
    getContextualPollPreviews({
      viewerUserId: user.id,
      limit: 3,
      attachments: [...pollAttachmentMap.values()],
    }),
  ]);
  const tabs = [
    { label: "All", href: "/voting?filter=all", active: filter === "all" },
    { label: "People", href: "/voting?filter=people", active: filter === "people" },
    { label: "Issues", href: "/voting?filter=issues", active: filter === "issues" },
    { label: "Cases", href: "/voting?filter=cases", active: filter === "cases" },
  ];
  const returnPath = `/voting?filter=${filter}`;
  const verified = canUserVote(user);

  return (
    <div className="relative mx-auto max-w-5xl space-y-5 overflow-hidden pb-10 pt-2 sm:pt-4">
      <div className="pointer-events-none absolute inset-x-[-12%] top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_45%),radial-gradient(circle_at_top_right,rgba(129,140,248,0.14),transparent_38%),radial-gradient(circle_at_top_left,rgba(52,211,153,0.16),transparent_36%)]" />
      {params?.voted === "success" ? (
        <section className="rounded-[1.75rem] border border-emerald-300/16 bg-emerald-500/10 p-5 text-sm text-emerald-100 shadow-[0_24px_50px_-36px_rgba(16,185,129,0.55)]">
          Your vote was recorded.
        </section>
      ) : null}
      {params?.voteError ? (
        <section className="rounded-[1.75rem] border border-orange-300/16 bg-orange-500/10 p-5 text-sm text-orange-100 shadow-[0_24px_50px_-36px_rgba(249,115,22,0.45)]">
          {params.voteError === "verification"
            ? "Voter verification is required before platform votes count toward civic outcomes."
            : "That vote could not be recorded. Please try again."}
        </section>
      ) : null}

      <section className="dd-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(52,211,153,0.12),transparent_32%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#34d399,#22d3ee,#818cf8)]" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <span>Weekly civic pulse</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">VOTE</h1>
            <p className="mt-2 text-sm text-slate-400">
              One question at a time. Vote on people, issues, and cases tied to your jurisdictions.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Your vote helps surface public priorities, sharpen community sentiment, and make civic participation feel immediate.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
            {getVerificationLabel(user.verificationState)}
          </span>
        </div>

        <div className={`relative mt-5 rounded-[1.5rem] border px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${verified ? "border-white/10 bg-white/5 text-slate-300" : "border-orange-300/16 bg-orange-500/10 text-orange-100"}`}>
          {verified
            ? "You’re verified to vote. Results appear right after you respond, so you can see where the public pulse stands."
            : "You can browse the queue now, but voting unlocks after voter verification is complete."}
        </div>

        <div className="mt-5">
          <FilterTabs tabs={tabs} />
        </div>
      </section>

      <VotingPageSections
        initialQuestions={questions}
        citizenPolls={citizenPolls}
        canVote={verified}
        returnPath={returnPath}
        activeFilter={filter}
      />
    </div>
  );
}
