import Link from "next/link";

import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { sendThreadReply, updateInterviewRequestStatus, updateMessageRequestState } from "@/lib/messages/actions";
import type { MessagingThreadDetail } from "@/types/domain";

type MessageThreadDetailProps = {
  thread: MessagingThreadDetail;
  statusMessage?: string;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function subjectTypeLabel(value: NonNullable<MessagingThreadDetail["messages"][number]["subjectType"]>) {
  if (value === "needHelp") return "Need help";
  if (value === "supportOppose") return "Support / Oppose";
  if (value === "feedbackConcern") return "Feedback / concern";
  if (value === "interviewRequest") return "Interview request";
  return "Other";
}

function issueCategoryLabel(value: NonNullable<MessagingThreadDetail["messages"][number]["issueCategory"]>) {
  if (value === "potholeRoadIssue") return "Pothole / road issue";
  if (value === "permitsZoning") return "Permits / zoning";
  if (value === "schoolDistrictIssue") return "School / district issue";
  if (value === "utilitiesWater") return "Utilities / water";
  if (value === "publicSafety") return "Public safety";
  if (value === "taxesBilling") return "Taxes / billing";
  if (value === "housing") return "Housing";
  if (value === "businessLicensing") return "Business / licensing";
  return "Other";
}

function levelLabel(value: NonNullable<MessagingThreadDetail["messages"][number]["level"]>) {
  if (value === "local") return "Local";
  if (value === "state") return "State";
  return "Federal";
}

function routeTypeLabel(value: NonNullable<MessagingThreadDetail["messages"][number]["routeType"]>) {
  return value === "officialType" ? "Official type" : "Issue / need type";
}

export function MessageThreadDetail({ thread, statusMessage }: MessageThreadDetailProps) {
  const interviewRequest = thread.interviewRequest;

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
            {thread.participantRole}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
            {thread.requestState}
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">{thread.participantName}</h1>
        <p className="mt-2 text-sm text-slate-500">{thread.jurisdictionName}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={thread.participantProfileHref} className="text-sm font-semibold text-civic-700 transition hover:text-civic-900">
            View public profile
          </Link>
          <Link href="/messages" className="text-sm font-semibold text-slate-600 transition hover:text-ink">
            Back to inbox
          </Link>
        </div>
      </section>

      {statusMessage ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          {statusMessage}
        </section>
      ) : null}

      {interviewRequest ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-6 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
              Citizen Interview Request
            </span>
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
              {interviewRequest.status}
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink">{interviewRequest.topicTitle}</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
            <span className="rounded-full bg-white px-3 py-1 text-slate-700">{interviewRequest.requestedFormat}</span>
            <span className="rounded-full bg-white px-3 py-1 text-slate-700">Requested by {interviewRequest.requesterName}</span>
            {interviewRequest.issueTags.map((tag) => (
              <span key={tag} className="rounded-full bg-white px-3 py-1 text-slate-700">
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">{interviewRequest.proposedQuestions}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {thread.viewerIsRecipient && interviewRequest.status === "pending" ? (
              <>
                <form action={updateInterviewRequestStatus}>
                  <input type="hidden" name="interviewId" value={interviewRequest.id} />
                  <input type="hidden" name="status" value="accepted" />
                  <FormSubmitButton
                    idleLabel="Accept interview"
                    pendingLabel="Saving..."
                    className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                  />
                </form>
                <form action={updateInterviewRequestStatus}>
                  <input type="hidden" name="interviewId" value={interviewRequest.id} />
                  <input type="hidden" name="status" value="declined" />
                  <FormSubmitButton
                    idleLabel="Decline"
                    pendingLabel="Saving..."
                    className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                  />
                </form>
              </>
            ) : null}
            {thread.viewerIsRecipient && interviewRequest.status === "accepted" ? (
              <form action={updateInterviewRequestStatus}>
                <input type="hidden" name="interviewId" value={interviewRequest.id} />
                <input type="hidden" name="status" value="completed" />
                <FormSubmitButton
                  idleLabel="Mark completed"
                  pendingLabel="Saving..."
                  className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                />
              </form>
            ) : null}
            {thread.viewerIsSender && (interviewRequest.status === "pending" || interviewRequest.status === "accepted") ? (
              <form action={updateInterviewRequestStatus}>
                <input type="hidden" name="interviewId" value={interviewRequest.id} />
                <input type="hidden" name="status" value="canceled" />
                <FormSubmitButton
                  idleLabel="Cancel request"
                  pendingLabel="Saving..."
                  className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                />
              </form>
            ) : null}
            {thread.viewerIsSender && interviewRequest.status === "completed" && !interviewRequest.publishedPostId ? (
              <Link
                href={`/interviews/${interviewRequest.id}/publish`}
                className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Publish interview post
              </Link>
            ) : null}
            {interviewRequest.eventId ? (
              <Link
                href={`/events/${interviewRequest.eventId}`}
                className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                View interview event
              </Link>
            ) : null}
            {interviewRequest.publishedPostId ? (
              <Link
                href={`/posts/${interviewRequest.publishedPostId}`}
                className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                View published interview
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {!interviewRequest && thread.viewerIsRecipient && thread.requestState === "pending" ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-6 shadow-card">
          <p className="text-sm font-semibold text-orange-900">Message request</p>
          <p className="mt-2 text-sm leading-6 text-orange-900">
            First-time messages stay separate until you decide whether to accept, ignore, block, or report them.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {["accepted", "ignored", "blocked", "reported"].map((state) => (
              <form key={state} action={updateMessageRequestState}>
                <input type="hidden" name="threadId" value={thread.id} />
                <input type="hidden" name="state" value={state} />
                <FormSubmitButton
                  idleLabel={state === "accepted" ? "Accept" : state === "ignored" ? "Ignore" : state === "blocked" ? "Block" : "Report"}
                  pendingLabel="Saving..."
                  className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </form>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="space-y-4">
          {thread.messages.map((message) => {
            return (
              <div
                key={message.id}
                className={message.senderUserId === thread.participantUserId ? "rounded-3xl bg-slate-50 p-4" : "rounded-3xl bg-civic-50 p-4"}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{message.senderName}</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {message.senderRole}
                  </span>
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{formatTimestamp(message.createdAt)}</span>
                </div>
                {message.subjectLine ? <p className="mt-3 text-sm font-semibold text-ink">{message.subjectLine}</p> : null}
                {message.subjectType ||
                message.level ||
                message.routeType ||
                message.selectedOfficialType ||
                message.selectedIssueType ||
                message.issueCategory ||
                message.issueText ||
                message.supportPosition ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
                    {message.level ? (
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">{levelLabel(message.level)}</span>
                    ) : null}
                    {message.routeType ? (
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">{routeTypeLabel(message.routeType)}</span>
                    ) : null}
                    {message.selectedOfficialType ? (
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">{message.selectedOfficialType}</span>
                    ) : null}
                    {message.selectedIssueType ? (
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">{message.selectedIssueType}</span>
                    ) : null}
                    {message.subjectType ? (
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">{subjectTypeLabel(message.subjectType)}</span>
                    ) : null}
                    {message.issueCategory ? (
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">{issueCategoryLabel(message.issueCategory)}</span>
                    ) : null}
                    {message.issueText ? (
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700">{message.issueText}</span>
                    ) : null}
                    {message.supportPosition ? (
                      <span className="rounded-full bg-white px-3 py-1 text-civic-700">{message.supportPosition}</span>
                    ) : null}
                  </div>
                ) : null}
                <p className="mt-3 text-sm leading-6 text-slate-700">{message.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {thread.canReply && thread.requestState !== "blocked" && thread.requestState !== "reported" ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-sm font-semibold text-ink">Reply</p>
          <form action={sendThreadReply} className="mt-4 space-y-4">
            <input type="hidden" name="threadId" value={thread.id} />
            <textarea
              name="body"
              rows={5}
              minLength={2}
              required
              placeholder="Write a concise message."
              className="w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
            />
            <FormSubmitButton
              idleLabel="Send reply"
              pendingLabel="Sending..."
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            />
          </form>
        </section>
      ) : null}
    </div>
  );
}
