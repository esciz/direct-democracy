import { notFound } from "next/navigation";

import { CommunityEventCard } from "@/components/domain/community-event-card";
import { CommunityPetitionCard } from "@/components/domain/community-petition-card";
import { MyOfficialCard } from "@/components/domain/my-official-card";
import { PollCard } from "@/components/domain/poll-card";
import { PostCard } from "@/components/domain/post-card";
import { SchoolCard } from "@/components/domain/school-card";
import { TopIssueCard } from "@/components/domain/top-issue-card";
import { VoteCard } from "@/components/domain/vote-card";
import { PageIntro } from "@/components/ui/page-intro";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getSchoolById } from "@/lib/schools/store";

type SchoolDetailPageProps = {
  params: Promise<{
    schoolId: string;
  }>;
  searchParams?: Promise<{
    voted?: string;
    voteError?: string;
    pollVote?: string;
    pollError?: string;
    credits?: string;
    pollPromotion?: string;
    pollPromotionError?: string;
  }>;
};

export default async function SchoolDetailPage({ params, searchParams }: SchoolDetailPageProps) {
  const { schoolId } = await params;
  const user = await getCurrentUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const school = await getSchoolById(user, schoolId);

  if (!school) {
    notFound();
  }

  const returnPath = `/schools/${school.id}`;

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="School"
        title={school.name}
        description="Local school context built around community questions, education issues, related petitions, public discussion, and the officials connected to district decisions."
        meta={
          <>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">{school.district}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Grades {school.gradeLevels.join("–")}
            </span>
            {typeof school.enrollment === "number" ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {school.enrollment.toLocaleString()} students
              </span>
            ) : null}
            {typeof school.studentTeacherRatio === "number" ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Ratio {school.studentTeacherRatio.toFixed(1)}:1
              </span>
            ) : null}
          </>
        }
      />

      {resolvedSearchParams?.voted === "success" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your school-related vote was recorded.
        </section>
      ) : null}
      {resolvedSearchParams?.voteError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          That vote could not be recorded. Please try again.
        </section>
      ) : null}
      {resolvedSearchParams?.pollVote === "success" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your school-related poll vote was recorded.
        </section>
      ) : null}
      {resolvedSearchParams?.pollError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          That poll action could not be completed. Please try again.
        </section>
      ) : null}
      {resolvedSearchParams?.pollPromotion ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          {resolvedSearchParams.pollPromotion === "petition" && "This poll was converted into a petition."}
          {resolvedSearchParams.pollPromotion === "system-vote" && "This poll was promoted into a formal vote."}
        </section>
      ) : null}
      {resolvedSearchParams?.pollPromotionError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {resolvedSearchParams.pollPromotionError === "permissions" && "Only trusted citizens can promote a poll into a petition or formal vote."}
          {resolvedSearchParams.pollPromotionError === "threshold" && "This poll needs more engagement before it can be promoted."}
          {resolvedSearchParams.pollPromotionError === "confirm" && "Please confirm the conversion before promoting the poll."}
          {resolvedSearchParams.pollPromotionError === "duplicate-vote" && "A similar formal vote already exists for this jurisdiction."}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Basic info"
            title="School context"
            description="Optional metrics are shown only as background context. This feature does not rank or score schools."
          />
          <div className="mt-6">
            <SchoolCard school={school} />
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Community signals"
            title="Parent and community voting"
            description="School-related questions and polls help show what people around this school care about most right now."
          />
          <div className="mt-6 grid gap-4">
            {school.schoolQuestions.length ? (
              school.schoolQuestions.map((question) => <VoteCard key={question.id} question={question} compact returnPath={returnPath} />)
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">
                No school-specific questions are seeded for this school yet.
              </div>
            )}
          </div>
          <div className="mt-6 grid gap-4">
            {school.relatedPolls.map((poll) => (
              <PollCard key={poll.id} poll={poll} returnPath={returnPath} viewerRole={user.role} />
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Top issues"
            title="What is rising around this school"
            description="Local education-related issues surfaced from community priorities, write-ins, and trend snapshots."
          />
          <div className="mt-6 space-y-4">
            {school.topIssues.length ? (
              school.topIssues.map((issue) => <TopIssueCard key={issue.id} issue={issue} returnPath={returnPath} />)
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No school-related issues are seeded here yet.</div>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Issue trends"
            title="What is shifting over time"
            description="Recent community activity helps show whether education concerns are rising or flattening. This is directional context, not formal polling."
          />
          <div className="mt-6 space-y-4">
            {school.issueTrends.length ? (
              school.issueTrends.map((trend) => (
                <div key={trend.issue} className="rounded-3xl bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-ink">{trend.issue}</h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        trend.direction === "up"
                          ? "bg-emerald-50 text-emerald-700"
                          : trend.direction === "down"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {trend.change > 0 ? "+" : ""}
                      {trend.change} pts
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {trend.previousPercentage}% previously · {trend.currentPercentage}% now
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No school-related trend data is seeded for this community yet.</div>
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Petitions"
            title="Related petitions"
            description="Education and school-support petitions connected to this school’s district and issues."
          />
          <div className="mt-6 grid gap-4">
            {school.relatedPetitions.length ? (
              school.relatedPetitions.map((petition) => <CommunityPetitionCard key={petition.id} petition={petition} />)
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No related petitions are seeded for this school yet.</div>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Officials"
            title="Relevant officials"
            description="School board and other public officials connected to district funding, governance, and school-related decisions."
          />
          <div className="mt-6 grid gap-4">
            {school.relatedOfficials.length ? (
              school.relatedOfficials.map((official) => <MyOfficialCard key={official.id} official={official} />)
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No related officials are linked to this school yet.</div>
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Events"
            title="School-connected events"
            description="School board meetings, forums, and community gatherings related to education and classroom support."
          />
          <div className="mt-6 grid gap-4">
            {school.relatedEvents.length ? (
              school.relatedEvents.map((event) => <CommunityEventCard key={event.id} event={event} />)
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No related events are seeded for this school yet.</div>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Discussions"
            title="Related public posts"
            description="Recent official, candidate, and trusted-citizen posts that connect back to school issues in this community."
          />
          <div className="mt-6 space-y-4">
            {school.relatedPosts.length ? (
              school.relatedPosts.map((post) => (
                <PostCard key={post.id} post={post} viewerRole={user.role} viewerUserId={user.id} returnPath={returnPath} />
              ))
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No related posts are seeded for this school yet.</div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
