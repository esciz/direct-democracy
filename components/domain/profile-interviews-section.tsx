import Link from "next/link";

import type { InterviewRequestSummary, PublicProfileInterviewsSummary } from "@/types/domain";

type ProfileInterviewsSectionProps = {
  interviews: PublicProfileInterviewsSummary;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function InterviewGroup({
  title,
  description,
  items,
  emptyLabel,
  statusLabel,
}: {
  title: string;
  description: string;
  items: InterviewRequestSummary[];
  emptyLabel: string;
  statusLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold tracking-tight text-ink">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </div>
      <div className="grid gap-4">
        {items.length ? (
          items.map((interview) => (
            <div key={interview.id} className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{interview.topicTitle}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(interview.createdAt)} · {interview.requestedFormat} · Requested by {interview.requesterName}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                  {statusLabel}
                </span>
              </div>
              {interview.issueTags.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {interview.issueTags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {interview.publishedPostId ? (
                <div className="mt-4 flex flex-wrap gap-4">
                  {interview.eventId ? (
                    <Link href={`/events/${interview.eventId}`} className="text-sm font-semibold text-slate-700 hover:text-civic-800">
                      View interview event
                    </Link>
                  ) : null}
                  <Link href={`/posts/${interview.publishedPostId}`} className="text-sm font-semibold text-civic-700 hover:text-civic-800">
                    View interview post
                  </Link>
                </div>
              ) : interview.eventId ? (
                <div className="mt-4">
                  <Link href={`/events/${interview.eventId}`} className="text-sm font-semibold text-slate-700 hover:text-civic-800">
                    View interview event
                  </Link>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 shadow-card">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProfileInterviewsSection({ interviews }: ProfileInterviewsSectionProps) {
  return (
    <section className="space-y-6 rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Interviews</h2>
        <p className="mt-2 text-sm text-slate-600">
          Structured trusted-citizen interview requests and finished interviews tied to this public profile.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
          {interviews.responsiveness.signalLabel ? (
            <span className="rounded-full bg-civic-50 px-3 py-1 text-civic-700">{interviews.responsiveness.signalLabel}</span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            {interviews.responsiveness.acceptedCount} booked
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            {interviews.responsiveness.completedCount} completed
          </span>
          {interviews.responsiveness.noResponseCount ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
              {interviews.responsiveness.noResponseCount} no response
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-slate-600">{interviews.responsiveness.signalDescription}</p>
      </div>

      <InterviewGroup
        title="Requested"
        description="Current citizen interview requests still waiting on an answer."
        items={interviews.requested}
        emptyLabel="No active interview requests are visible right now."
        statusLabel="Requested"
      />
      <InterviewGroup
        title="Booked / Accepted"
        description="Interview requests that were accepted and now have a public interview event or active booking."
        items={interviews.accepted}
        emptyLabel="No booked interviews are visible yet."
        statusLabel="Booked"
      />
      <InterviewGroup
        title="Completed interviews"
        description="Finished interviews that can link to the published interview post."
        items={interviews.completed}
        emptyLabel="No completed interviews are visible yet."
        statusLabel="Completed"
      />
      <InterviewGroup
        title="Declined"
        description="Requests that received a clear decline."
        items={interviews.declined}
        emptyLabel="No declined interviews are visible yet."
        statusLabel="Declined"
      />
      <InterviewGroup
        title="No response"
        description="Older requests that are still unresolved and currently count as no response."
        items={interviews.noResponse}
        emptyLabel="No no-response interview requests are visible yet."
        statusLabel="No Response"
      />
    </section>
  );
}
