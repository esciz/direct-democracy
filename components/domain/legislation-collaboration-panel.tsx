import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { submitLegislationSuggestion, voteOnLegislationSuggestion } from "@/lib/petitions/collaboration-actions";
import type { DraftLegislationDetail } from "@/types/domain";

type LegislationCollaborationPanelProps = {
  legislation: DraftLegislationDetail;
};

function statusTone(status: DraftLegislationDetail["proposedChanges"][number]["status"]) {
  if (status === "accepted") {
    return "bg-civic-50 text-civic-700";
  }

  if (status === "rejected") {
    return "bg-orange-50 text-orange-700";
  }

  return "bg-slate-100 text-slate-700";
}

export function LegislationCollaborationPanel({ legislation }: LegislationCollaborationPanelProps) {
  return (
    <section className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-700">Structured collaboration</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Public suggestions on the current draft</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Only people who signed the linked petition can submit a proposed change or vote to adopt or reject one. This is for structured drafting input, not free-form discussion.
        </p>
        {legislation.viewerCanSuggestChanges ? (
          <form action={submitLegislationSuggestion} className="mt-5 space-y-4">
            <input type="hidden" name="legislationId" value={legislation.id} />
            <input
              type="text"
              name="sectionReference"
              placeholder="Section reference (optional)"
              className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
            />
            <textarea
              name="changeText"
              rows={5}
              minLength={20}
              required
              placeholder="Describe a specific draft change residents should consider."
              className="w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
            />
            <FormSubmitButton
              idleLabel="Add suggestion"
              pendingLabel="Submitting..."
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            />
          </form>
        ) : (
          <div className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
            Sign the linked petition first to submit a proposed change or vote on one.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Proposed changes</h2>
          <p className="mt-2 text-sm text-slate-600">Each suggestion stays structured so drafters can see concrete edits and where support is building.</p>
        </div>
        <div className="space-y-4">
          {legislation.proposedChanges.length ? (
            legislation.proposedChanges.map((change) => (
              <article key={change.id} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusTone(change.status)}`}>
                    {change.status}
                  </span>
                  {change.sectionReference ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                      {change.sectionReference}
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-700">{change.changeText}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <span>{change.userName}</span>
                  <span>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(change.createdAt))}</span>
                  <span>{change.adoptCount} adopt</span>
                  <span>{change.rejectCount} reject</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <form action={voteOnLegislationSuggestion}>
                    <input type="hidden" name="legislationId" value={legislation.id} />
                    <input type="hidden" name="changeId" value={change.id} />
                    <input type="hidden" name="vote" value="adopt" />
                    <FormSubmitButton
                      idleLabel={change.viewerVote === "adopt" ? "Adopted" : "Vote adopt"}
                      pendingLabel="Saving..."
                      className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </form>
                  <form action={voteOnLegislationSuggestion}>
                    <input type="hidden" name="legislationId" value={legislation.id} />
                    <input type="hidden" name="changeId" value={change.id} />
                    <input type="hidden" name="vote" value="reject" />
                    <FormSubmitButton
                      idleLabel={change.viewerVote === "reject" ? "Rejected" : "Vote reject"}
                      pendingLabel="Saving..."
                      className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-400 hover:text-orange-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </form>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 shadow-card">
              No structured suggestions yet.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
