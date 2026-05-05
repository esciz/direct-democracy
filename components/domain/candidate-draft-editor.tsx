import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { publishCandidateDraft, saveCandidateDraft } from "@/lib/candidates/draft-actions";
import type { CandidateDraftSummary } from "@/types/domain";

type CandidateDraftEditorProps = {
  draft: CandidateDraftSummary;
  followerCount: number;
  endorsementCount: number;
  topIssues: string[];
  userName: string;
  successState?: "draft" | "published" | null;
};

const fallbackPromises = [
  { id: "draft_blank_1", title: "", description: "", category: "" },
  { id: "draft_blank_2", title: "", description: "", category: "" },
  { id: "draft_blank_3", title: "", description: "", category: "" },
];

export function CandidateDraftEditor({
  draft,
  followerCount,
  endorsementCount,
  topIssues,
  userName,
  successState,
}: CandidateDraftEditorProps) {
  const editablePromises = [...draft.campaignPromises, ...fallbackPromises].slice(0, 4);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Candidate preview</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{userName}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {draft.officeSought} · {draft.jurisdictionName}
        </p>
        <p className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm leading-6 text-slate-700">
          {draft.bio?.trim() || "No campaign bio yet. Add a short explanation of what you care about and why you want to serve."}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl bg-civic-50 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-civic-700">Followers</p>
            <p className="mt-2 text-2xl font-semibold text-civic-900">{followerCount.toLocaleString()}</p>
          </div>
          <div className="rounded-3xl bg-slate-950 p-4 text-white">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Endorsements</p>
            <p className="mt-2 text-2xl font-semibold">{endorsementCount}</p>
          </div>
          <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Election</p>
            <p className="mt-2 text-sm font-semibold text-ink">{draft.electionTitle}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Top issues</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {topIssues.length ? (
                topIssues.map((issue) => (
                  <span key={issue} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {issue}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">Your saved issue priorities will appear here.</span>
              )}
            </div>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Campaign promises</p>
            <div className="mt-3 space-y-3">
              {draft.campaignPromises.length ? (
                draft.campaignPromises.map((promise) => (
                  <div key={promise.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{promise.title}</p>
                      {promise.category ? (
                        <span className="rounded-full bg-civic-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-civic-700">
                          {promise.category}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{promise.description}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">
                  No campaign promises yet. You can draft them here before making anything public.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        {successState === "draft" ? (
          <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
            Your candidate profile draft was saved. It is still private.
          </section>
        ) : null}

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Draft profile</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Shape your platform presence</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This draft only lives on the platform. It does not file you for office or represent legal candidacy.
          </p>

          <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm leading-6 text-slate-700">
            <p className="font-semibold text-ink">Before you publish</p>
            <p className="mt-2">This will make your candidate profile visible to the public inside Direct Democracy.</p>
          </div>

          <form action={saveCandidateDraft} className="mt-6 space-y-4">
            <input type="hidden" name="electionId" value={draft.electionId} />
            <input type="hidden" name="officeSought" value={draft.officeSought} />
            <input type="hidden" name="electionTitle" value={draft.electionTitle} />
            <input type="hidden" name="jurisdictionName" value={draft.jurisdictionName} />
            <input type="hidden" name="electionDate" value={draft.electionDate} />
            <div className="grid gap-3">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-ink">Campaign bio</span>
                <textarea
                  name="bio"
                  rows={5}
                  defaultValue={draft.bio ?? ""}
                  placeholder="What would you want people in this race to know about you?"
                  className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                />
              </label>
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
                    rows={3}
                    defaultValue={promise.description}
                    placeholder="Short description"
                    className="rounded-3xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <FormSubmitButton
                idleLabel="Keep as draft"
                pendingLabel="Saving..."
                className="rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              <button
                type="submit"
                formAction={publishCandidateDraft}
                className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Publish candidate profile
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
