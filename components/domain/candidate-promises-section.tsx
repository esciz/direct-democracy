import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { updateCandidatePromises } from "@/lib/candidates/actions";
import type { CampaignPromiseSummary } from "@/types/domain";

type CandidatePromisesSectionProps = {
  candidateId: string;
  promises: CampaignPromiseSummary[];
  canEdit: boolean;
};

const fallbackPromises: CampaignPromiseSummary[] = [
  { id: "blank_candidate_1", title: "", description: "", category: "" },
  { id: "blank_candidate_2", title: "", description: "", category: "" },
  { id: "blank_candidate_3", title: "", description: "", category: "" },
];

export function CandidatePromisesSection({ candidateId, promises, canEdit }: CandidatePromisesSectionProps) {
  const editablePromises = [...promises, ...fallbackPromises].slice(0, 4);

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Public Reliability inputs</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Campaign commitments shaping Public Reliability</h2>

      <div className="mt-6 grid gap-4">
        {promises.length ? (
          promises.map((promise) => (
            <article key={promise.id} className="rounded-3xl bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-ink">{promise.title}</h3>
                {promise.category ? (
                  <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
                    {promise.category}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{promise.description}</p>
            </article>
          ))
        ) : (
          <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No campaign promises have been published yet.</div>
        )}
      </div>

      {canEdit ? (
        <form action={updateCandidatePromises} className="mt-6 space-y-4">
          <input type="hidden" name="candidateId" value={candidateId} />
          {editablePromises.map((promise, index) => (
            <div key={`${promise.id}-${index}`} className="grid gap-3 rounded-3xl bg-white p-4 ring-1 ring-slate-200">
              <input
                name={`promiseTitle${index}`}
                defaultValue={promise.title}
                placeholder="Promise title"
                className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
              <input
                name={`promiseCategory${index}`}
                defaultValue={promise.category ?? ""}
                placeholder="Optional category"
                className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
              <textarea
                name={`promiseDescription${index}`}
                defaultValue={promise.description}
                rows={3}
                placeholder="Short description"
                className="rounded-3xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
            </div>
          ))}
          <FormSubmitButton
            idleLabel="Save campaign promises"
            pendingLabel="Saving..."
            className="rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          />
        </form>
      ) : null}
    </section>
  );
}
