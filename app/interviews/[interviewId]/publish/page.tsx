import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { publishInterviewPost } from "@/lib/messages/actions";
import { canUserPublishInterview, getInterviewRequestById } from "@/lib/server/interviews";

type PublishInterviewPageProps = {
  params: Promise<{
    interviewId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function PublishInterviewPage({ params, searchParams }: PublishInterviewPageProps) {
  const currentUser = await getCurrentUser();
  const { interviewId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const interview = await getInterviewRequestById(interviewId);

  if (!interview) {
    notFound();
  }

  if (
    !canUserPublishInterview(currentUser) ||
    interview.requesterUserId !== currentUser.id ||
    interview.status !== "completed" ||
    interview.publishedPostId
  ) {
    redirect(`/messages/${interview.threadId}`);
  }

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Publish Interview"
        title={`Publish interview with ${interview.recipientName}`}
        description="Turn a completed trusted-citizen interview into a special interview post that can circulate through the rest of the platform."
        actions={
          <Link
            href={`/messages/${interview.threadId}`}
            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to interview thread
          </Link>
        }
      />

      {resolvedSearchParams?.error === "invalid" ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          Add a clear title, summary, and transcript or Q&amp;A before publishing.
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="mb-5 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
          <span className="rounded-full bg-civic-50 px-3 py-1 text-civic-700">Interview Post</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{interview.requestedFormat}</span>
          {interview.issueTags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {tag}
            </span>
          ))}
        </div>

        <form action={publishInterviewPost} className="space-y-5">
          <input type="hidden" name="interviewId" value={interview.id} />

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold text-ink">Title</span>
            <input
              type="text"
              name="title"
              defaultValue={`Interview: ${interview.recipientName} on ${interview.topicTitle}`}
              className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold text-ink">Summary</span>
            <textarea
              name="summary"
              rows={4}
              defaultValue={`Trusted citizen interview with ${interview.recipientName} about ${interview.topicTitle}.`}
              className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold text-ink">Transcript / Q&amp;A / written response</span>
            <textarea
              name="transcript"
              rows={10}
              defaultValue={interview.proposedQuestions}
              className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold text-ink">Optional media link</span>
            <input
              type="url"
              name="mediaUrl"
              placeholder="https://example.com/interview-video"
              className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
            />
          </label>

          <FormSubmitButton
            idleLabel="Publish interview"
            pendingLabel="Publishing..."
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          />
        </form>
      </section>
    </div>
  );
}
