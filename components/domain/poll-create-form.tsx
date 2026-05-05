import Link from "next/link";

import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { createPoll } from "@/lib/polls/actions";
import type { VoteQuestionScope } from "@/types/domain";

type PollCreateFormProps = {
  roleLabel: string;
  jurisdictionName: string;
  defaultJurisdictionId?: string | null;
  error?: string;
  attachmentPrefill?: {
    type: string;
    id: string;
    label: string;
    jurisdictionId?: string | null;
  } | null;
};

const scopeHelperText: Record<VoteQuestionScope, string> = {
  local: "Targets your local jurisdiction and shows up in the matching community view.",
  state: "Targets the Nevada-wide community context.",
  national: "Targets the national community context.",
};

const attachmentOptions = [
  { value: "community", label: "Community / jurisdiction" },
  { value: "issue", label: "Issue / action / case" },
  { value: "official", label: "Official / candidate" },
  { value: "petition", label: "Petition / legislation" },
  { value: "election", label: "Election" },
  { value: "coalition", label: "Coalition / group / event" },
] as const;

export function PollCreateForm({ roleLabel, jurisdictionName, defaultJurisdictionId = null, error, attachmentPrefill = null }: PollCreateFormProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          {roleLabel}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
          {jurisdictionName}
        </span>
      </div>

      <form action={createPoll} className="mt-6 space-y-4">
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Where should this poll appear?</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Polls must be tied to a real community, issue, person, election, petition, or coalition before they can be published.
          </p>
          {attachmentPrefill ? (
            <div className="mt-3 rounded-2xl border border-civic-200 bg-civic-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">This poll will appear on</p>
              <p className="mt-2 text-sm font-semibold text-ink">{attachmentPrefill.label}</p>
              <input type="hidden" name="attachmentType" value={attachmentPrefill.type} />
              <input type="hidden" name="attachmentId" value={attachmentPrefill.id} />
              <input type="hidden" name="attachmentLabel" value={attachmentPrefill.label} />
              <input type="hidden" name="attachmentJurisdictionId" value={attachmentPrefill.jurisdictionId ?? defaultJurisdictionId ?? ""} />
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <div>
                <label htmlFor="attachmentType" className="text-sm font-semibold text-ink">
                  Attach this poll to
                </label>
                <select
                  id="attachmentType"
                  name="attachmentType"
                  defaultValue=""
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                >
                  <option value="">Choose a destination</option>
                  {attachmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="attachmentLabel" className="text-sm font-semibold text-ink">
                  Destination name
                </label>
                <input
                  id="attachmentLabel"
                  name="attachmentLabel"
                  type="text"
                  placeholder="Carson City Community or Board agenda item"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                />
                <input type="hidden" name="attachmentJurisdictionId" value={defaultJurisdictionId ?? ""} />
              </div>
            </div>
          )}
          {error === "attachment" ? (
            <p className="mt-3 text-sm font-medium text-orange-700">Choose where this poll belongs before publishing it.</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="question" className="text-sm font-semibold text-ink">
            Poll question
          </label>
          <input
            id="question"
            name="question"
            type="text"
            maxLength={160}
            placeholder="What should Carson City prioritize first?"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          />
          {error === "question" ? (
            <p className="mt-2 text-sm font-medium text-orange-700">Write a clear question with at least 12 characters.</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="scope" className="text-sm font-semibold text-ink">
            Scope
          </label>
          <select
            id="scope"
            name="scope"
            defaultValue="local"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          >
            <option value="local">Local</option>
            <option value="state">State</option>
            <option value="national">National</option>
          </select>
          <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
            {Object.entries(scopeHelperText).map(([scope, text]) => (
              <p key={scope}>{text}</p>
            ))}
          </div>
          {error === "scope" ? <p className="mt-2 text-sm font-medium text-orange-700">Choose a valid scope.</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="optionOne" className="text-sm font-semibold text-ink">
              Option 1
            </label>
            <input
              id="optionOne"
              name="optionOne"
              type="text"
              placeholder="Reliable livestreams"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
            />
          </div>
          <div>
            <label htmlFor="optionTwo" className="text-sm font-semibold text-ink">
              Option 2
            </label>
            <input
              id="optionTwo"
              name="optionTwo"
              type="text"
              placeholder="Agenda summaries"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
            />
          </div>
          <div>
            <label htmlFor="optionThree" className="text-sm font-semibold text-ink">
              Option 3
            </label>
            <input
              id="optionThree"
              name="optionThree"
              type="text"
              placeholder="Monthly town hall"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
            />
          </div>
          <div>
            <label htmlFor="optionFour" className="text-sm font-semibold text-ink">
              Option 4
            </label>
            <input
              id="optionFour"
              name="optionFour"
              type="text"
              placeholder="Optional"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
            />
          </div>
        </div>
        {error === "options" ? (
          <p className="text-sm font-medium text-orange-700">Use 2 to 4 distinct options, each with at least 2 characters.</p>
        ) : null}

        <div>
          <label htmlFor="expiresAt" className="text-sm font-semibold text-ink">
            Expiration date
          </label>
          <input
            id="expiresAt"
            name="expiresAt"
            type="datetime-local"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          />
          {error === "expiresAt" ? (
            <p className="mt-2 text-sm font-medium text-orange-700">Enter a valid future date or leave this blank.</p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Optional. Leave blank to keep the poll open.</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <FormSubmitButton
            idleLabel="Publish poll"
            pendingLabel="Publishing..."
            className="rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          />
          <Link
            href="/polls"
            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to polls
          </Link>
        </div>
      </form>
    </section>
  );
}
