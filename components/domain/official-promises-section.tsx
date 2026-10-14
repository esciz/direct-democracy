import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { updateOfficialPromises } from "@/lib/officials/actions";
import type { CampaignPromiseSummary } from "@/types/domain";

type OfficialPromisesSectionProps = {
  officialId: string;
  promises: CampaignPromiseSummary[];
  canEdit: boolean;
};

const fallbackPromises: CampaignPromiseSummary[] = [
  { id: "blank_1", title: "", description: "", category: null, status: "In Progress", notes: "" },
  { id: "blank_2", title: "", description: "", category: null, status: "In Progress", notes: "" },
  { id: "blank_3", title: "", description: "", category: null, status: "In Progress", notes: "" },
];

export function OfficialPromisesSection({ officialId, promises, canEdit }: OfficialPromisesSectionProps) {
  const editablePromises = [...promises, ...fallbackPromises].slice(0, 4);

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Public Reliability inputs</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Public commitments behind the reliability summary</h2>

      <div className="mt-6 grid gap-4">
        {promises.length ? (
          promises.map((promise) => (
            <article key={promise.id} className="rounded-3xl bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-ink">{promise.title}</h3>
                <span
                  className={
                    promise.status === "Achieved"
                      ? "rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700"
                      : promise.status === "Reversed"
                        ? "rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700"
                        : "rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white"
                  }
                >
                  {promise.status ?? "In Progress"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{promise.description}</p>
              {promise.notes ? <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">{promise.notes}</p> : null}
            </article>
          ))
        ) : (
          <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No promises have been published yet.</div>
        )}
      </div>

      {canEdit ? (
        <form action={updateOfficialPromises} className="mt-6 space-y-4">
          <input type="hidden" name="officialId" value={officialId} />
          {editablePromises.map((promise, index) => (
            <div key={`${promise.id}-${index}`} className="grid gap-3 rounded-3xl bg-white p-4 ring-1 ring-slate-200">
              <input
                name={`promiseTitle${index}`}
                defaultValue={promise.title}
                placeholder="Promise title"
                className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
              <textarea
                name={`promiseDescription${index}`}
                defaultValue={promise.description}
                rows={2}
                placeholder="Promise description"
                className="rounded-3xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
              <select
                name={`promiseStatus${index}`}
                defaultValue={promise.status ?? "In Progress"}
                className="rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              >
                <option value="In Progress">In Progress</option>
                <option value="Achieved">Achieved</option>
                <option value="Reversed">Reversed</option>
              </select>
              <textarea
                name={`promiseNotes${index}`}
                defaultValue={promise.notes ?? ""}
                rows={2}
                placeholder="Notes"
                className="rounded-3xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
            </div>
          ))}
          <FormSubmitButton
            idleLabel="Save promise updates"
            pendingLabel="Saving..."
            className="rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          />
        </form>
      ) : null}
    </section>
  );
}
