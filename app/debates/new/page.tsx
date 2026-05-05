import Link from "next/link";
import { notFound } from "next/navigation";

import { IssuePickerField } from "@/components/domain/issue-picker-field";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { PageIntro } from "@/components/ui/page-intro";
import { canUserCreateDebate } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/server/auth-session";
import { seedUsers } from "@/lib/auth/mock-users";
import { createPhaseOneDebate } from "@/lib/debates/actions";
import { getIssuePickerOptions } from "@/lib/server/issues";

type NewDebatePageProps = {
  searchParams?: Promise<{
    debateCreateError?: string;
    issueText?: string;
    invitedUserId?: string;
    title?: string;
    description?: string;
    recommended?: string;
    recommendedUserName?: string;
    recommendedReason?: string;
  }>;
};

export default async function NewDebatePage({ searchParams }: NewDebatePageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;

  if (!canUserCreateDebate(user)) {
    notFound();
  }

  const trustedOpponents = seedUsers.filter(
    (entry) => entry.role === "trustedCitizen" && entry.id !== user.id && entry.jurisdictionName === user.jurisdictionName,
  );
  const issueOptions = await getIssuePickerOptions(user);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Debates"
        title="Create a debate"
        description="Set up a lightweight two-side debate with a clear topic and simple ordered statements."
        actions={
          <Link
            href="/debates"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to debates
          </Link>
        }
      />

      {params?.debateCreateError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {params.debateCreateError === "permissions" && "Only trusted citizens can create debates in this phase."}
          {params.debateCreateError === "limit" && "You already have the maximum number of active debates for now."}
          {params.debateCreateError === "duplicate" && "A very similar active debate already exists."}
          {params.debateCreateError === "invalid" && "Please complete the title, description, and your side before creating the debate."}
        </section>
      ) : null}

      {params?.recommended === "1" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          {params.recommendedUserName
            ? `Recommended debate with ${params.recommendedUserName}.`
            : "Recommended debate opportunity."}{" "}
          {params.recommendedReason ? `${params.recommendedReason}. ` : ""}
          Use this prefilled setup as a starting point, then add your own framing before you publish.
        </section>
      ) : null}

      <form action={createPhaseOneDebate} className="space-y-6 rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur sm:p-8">
        <input type="hidden" name="returnPath" value="/debates/new" />

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-ink">Debate title</span>
          <input
            name="title"
            required
            defaultValue={params?.title ?? ""}
            placeholder="What should this debate focus on?"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-ink">Description</span>
          <textarea
            name="description"
            rows={4}
            required
            defaultValue={params?.description ?? ""}
            placeholder="Describe the topic and what each side will be debating."
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
          />
        </label>

        <IssuePickerField
          name="issueText"
          label="Issue tag (optional)"
          options={issueOptions}
          placeholder="Select a shared issue"
          defaultValue={params?.issueText ?? ""}
          helpText="Debates connected to an issue can appear on the matching issue page and use the shared canonical issue list."
          allowCustom={false}
          inputClassName="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
        />

        <div className="grid gap-5 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-ink">Side A label</span>
            <input
              name="sideAName"
              required
              placeholder="Side A"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-ink">Side B label</span>
            <input
              name="sideBName"
              required
              placeholder="Side B"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
            />
          </label>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-ink">Your side</span>
            <select
              name="chosenSide"
              defaultValue="A"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
            >
              <option value="A">I am on Side A</option>
              <option value="B">I am on Side B</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-ink">Invite other side (optional)</span>
            <select
              name="invitedUserId"
              defaultValue={params?.invitedUserId ?? ""}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
            >
              <option value="">No invite yet</option>
              {trustedOpponents.map((opponent) => (
                <option key={opponent.id} value={opponent.id}>
                  {opponent.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          Phase 1 keeps debates intentionally simple: two sides, ordered statements, and a readable public page without scoring, truth labels, fallacy tags, or winner logic.
        </div>

        <FormSubmitButton
          idleLabel="Create debate"
          pendingLabel="Creating..."
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        />
      </form>
    </div>
  );
}
