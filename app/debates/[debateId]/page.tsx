import { notFound } from "next/navigation";

import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { PageIntro } from "@/components/ui/page-intro";
import { ActionLabel, ThumbsDownIcon, ThumbsUpIcon } from "@/components/ui/action-icons";
import { canUserCreateDebate } from "@/lib/auth/guards";
import { PUBLIC_DEMO_DATA_ENABLED } from "@/lib/auth/constants";
import { getDefaultSeedUser } from "@/lib/auth/mock-users";
import { getCurrentUser } from "@/lib/server/auth-session";
import { reactToDebateTurn, submitPhaseOneDebateStatement } from "@/lib/debates/actions";
import { getDebateParticipants, getPhaseOneDebateDetail, getStoredDebateTurns } from "@/lib/debates/store";

type DebateDetailPageProps = {
  params: Promise<{
    debateId: string;
  }>;
  searchParams?: Promise<{
    debate?: string;
    debateError?: string;
  }>;
};

function withSectionTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 1800): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sideTone(side: "A" | "B") {
  return side === "A"
    ? "border-cyan-300/18 bg-cyan-500/10"
    : "border-amber-300/18 bg-amber-500/10";
}

function turnLabel(turnType: "opening" | "response" | "closing") {
  if (turnType === "opening") return "Opening";
  if (turnType === "response") return "Response";
  return "Closing";
}

export default async function DebateDetailPage({ params, searchParams }: DebateDetailPageProps) {
  const { debateId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const debate = await getPhaseOneDebateDetail(debateId);

  if (!debate) {
    notFound();
  }

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Debate"
        title={debate.title}
        description={debate.description}
        meta={
          <>
            <span className="rounded-full border border-violet-300/18 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
              Debate
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-200">
              {formatDateLabel(debate.createdAt)}
            </span>
            {debate.issueText ? (
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-200">
                {debate.issueText}
              </span>
            ) : null}
          </>
        }
      />

      <DebateDetailBody debateId={debateId} fallbackDebate={debate} resolvedSearchParams={resolvedSearchParams} />
    </div>
  );
}

async function DebateDetailBody({
  debateId,
  fallbackDebate,
  resolvedSearchParams,
}: {
  debateId: string;
  fallbackDebate: NonNullable<Awaited<ReturnType<typeof getPhaseOneDebateDetail>>>;
  resolvedSearchParams: Awaited<DebateDetailPageProps["searchParams"]>;
}) {
  const user = await withSectionTimeout(getCurrentUser(), "debate current user", 1200).catch((error) => {
    console.error(`[debate-detail] current user fallback for ${debateId}`, error);
    return getDefaultSeedUser();
  });
  const [debate, participants, storedTurns] = await Promise.all([
    withSectionTimeout(getPhaseOneDebateDetail(debateId, user.id), "debate detail", 1600).catch((error) => {
      console.error(`[debate-detail] debate detail fallback for ${debateId}`, error);
      return fallbackDebate;
    }),
    withSectionTimeout(getDebateParticipants(debateId), "debate participants", 1400).catch((error) => {
      console.error(`[debate-detail] debate participants fallback for ${debateId}`, error);
      return [];
    }),
    withSectionTimeout(getStoredDebateTurns(), "stored debate turns", 1200).catch((error) => {
      console.error(`[debate-detail] stored turns fallback for ${debateId}`, error);
      return [];
    }),
  ]);

  if (!debate) {
    notFound();
  }

  const viewerParticipant = participants.find((participant) => participant.userId === user.id) ?? null;
  const canSubmitStatement = canUserCreateDebate(user);
  const storedTurnIds = new Set(storedTurns.map((turn) => turn.id));
  const visibleStatements = PUBLIC_DEMO_DATA_ENABLED
    ? debate.statements
    : debate.statements.filter((statement) => storedTurnIds.has(statement.id));
  const statusMessage =
    resolvedSearchParams?.debate === "created"
      ? "Debate created. You can start adding statements."
      : resolvedSearchParams?.debate === "statement-saved"
        ? "Statement saved."
        : resolvedSearchParams?.debate === "sentiment-support"
          ? "Support recorded for that statement."
          : resolvedSearchParams?.debate === "sentiment-oppose"
            ? "Opposition recorded for that statement."
            : resolvedSearchParams?.debateError === "permissions"
              ? "You are not allowed to submit that statement."
              : resolvedSearchParams?.debateError === "invalid"
                ? "Please review the statement details and try again."
                : null;

  return (
    <>
      {statusMessage ? (
        <section
          className={`rounded-[1.75rem] p-5 text-sm shadow-card ${
            resolvedSearchParams?.debateError ? "border border-amber-300/16 bg-amber-500/10 text-amber-100" : "border border-cyan-300/16 bg-cyan-500/10 text-cyan-100"
          }`}
        >
          {statusMessage}
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="dd-panel-muted rounded-[1.75rem] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Side A</p>
          <p className="mt-2 text-lg font-semibold text-slate-50">{debate.sideAName}</p>
        </div>
        <div className="dd-panel-muted rounded-[1.75rem] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Side B</p>
          <p className="mt-2 text-lg font-semibold text-slate-50">{debate.sideBName}</p>
        </div>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Statements</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-50">Debate record</h2>
          <p className="mt-2 text-sm text-slate-400">
            Statements stay in order, clearly marked by side and turn so the exchange is easy to follow.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {visibleStatements.length ? (
            visibleStatements.map((statement) => (
              <article key={statement.id} className={`rounded-[1.5rem] border p-5 ${sideTone(statement.side)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                    Turn {statement.turnNumber}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                    {turnLabel(statement.turnType)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                    Side {statement.side}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-slate-200">
                    {statement.side === "A" ? debate.sideAName : debate.sideBName}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-slate-200">
                    {formatDateLabel(statement.createdAt)}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-slate-400">
                    <span className="font-semibold text-slate-100">{statement.createdByUserName}</span>
                  </p>
                  <p className="text-sm leading-7 text-slate-200">{statement.content}</p>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1">
                      <ActionLabel icon={<ThumbsUpIcon className="h-3.5 w-3.5" />}>{`Support ${statement.supportCount}`}</ActionLabel>
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1">
                      <ActionLabel icon={<ThumbsDownIcon className="h-3.5 w-3.5" />}>{`Oppose ${statement.opposeCount}`}</ActionLabel>
                    </span>
                  </div>
                  <form action={reactToDebateTurn} className="flex flex-wrap gap-2">
                    <input type="hidden" name="debateId" value={debate.id} />
                    <input type="hidden" name="turnId" value={statement.id} />
                    <input type="hidden" name="returnPath" value={`/debates/${debate.id}`} />
                    <FormSubmitButton
                      name="reaction"
                      value="support"
                      idleLabel={<ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>{statement.viewerReaction === "support" ? "Supported" : "Support"}</ActionLabel>}
                      pendingLabel={<ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>Saving...</ActionLabel>}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                        statement.viewerReaction === "support"
                          ? "dd-button-primary text-slate-950"
                          : "dd-button-secondary text-cyan-100 hover:border-cyan-300/30 hover:text-white"
                      }`}
                    />
                    <FormSubmitButton
                      name="reaction"
                      value="oppose"
                      idleLabel={<ActionLabel icon={<ThumbsDownIcon className="h-4 w-4" />}>{statement.viewerReaction === "oppose" ? "Opposed" : "Oppose"}</ActionLabel>}
                      pendingLabel={<ActionLabel icon={<ThumbsDownIcon className="h-4 w-4" />}>Saving...</ActionLabel>}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                        statement.viewerReaction === "oppose"
                          ? "border border-amber-300/18 bg-amber-500/80 text-amber-950"
                          : "border border-amber-300/18 bg-amber-500/10 text-amber-100 hover:border-amber-300/28"
                      }`}
                    />
                  </form>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
              No real citizen statements yet. Seeded demo debate turns are hidden outside explicit demo mode.
            </div>
          )}
        </div>
      </section>

      {canSubmitStatement ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Add Statement</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Submit a side statement</h2>
            <p className="mt-2 text-sm text-slate-600">
              Add one statement at a time. If you are already attached to a side, the form keeps you there.
            </p>
          </div>

          <form action={submitPhaseOneDebateStatement} className="mt-5 space-y-4">
            <input type="hidden" name="debateId" value={debate.id} />
            <input type="hidden" name="returnPath" value={`/debates/${debate.id}`} />

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Side</span>
              <select
                name="side"
                defaultValue={viewerParticipant?.side ?? "A"}
                disabled={Boolean(viewerParticipant)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500 disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="A">Side A · {debate.sideAName}</option>
                <option value="B">Side B · {debate.sideBName}</option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">Statement</span>
              <textarea
                name="statementText"
                rows={5}
                required
                minLength={8}
                placeholder="Write a clear statement for your side."
                className="w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner outline-none transition focus:border-civic-400 focus:ring-2 focus:ring-civic-100"
              />
            </label>

            <FormSubmitButton
              idleLabel="Submit statement"
              pendingLabel="Saving..."
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            />
          </form>
        </section>
      ) : null}
    </>
  );
}
