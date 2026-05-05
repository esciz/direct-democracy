import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { ActionLabel, ScaleIcon, ThumbsDownIcon, ThumbsUpIcon } from "@/components/ui/action-icons";
import { TruthMeter } from "@/components/domain/truth-meter";
import { DEBATE_FALLACY_DEFINITIONS, DEBATE_FALLACY_TYPES } from "@/lib/debates/fallacies";
import { reactToDebateTurn, reviewDebateFallacyTag, tagDebateTurnFallacy } from "@/lib/debates/actions";
import { getTruthMeter } from "@/lib/truth/ratings";
import type { DebateTurnSummary, UserRole } from "@/types/domain";

type DebateTurnCardProps = {
  debateId: string;
  turn: DebateTurnSummary;
  viewerRole: UserRole;
  viewerUserId: string;
  returnPath: string;
};

function turnTone(side: DebateTurnSummary["side"]) {
  return side === "A" ? "border-civic-200 bg-civic-50/70" : "border-orange-200 bg-orange-50/70";
}

function isDirectVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

export async function DebateTurnCard({ debateId, turn, viewerRole, viewerUserId, returnPath }: DebateTurnCardProps) {
  const truthMeter = await getTruthMeter(turn.id, viewerUserId);
  const canTagFallacies = viewerRole === "trustedCitizen";

  return (
    <section className={`rounded-[1.75rem] border p-5 shadow-card ${turnTone(turn.side)}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
          Side {turn.side}
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
          {turn.turnType}
        </span>
      </div>
      <p className="mt-4 text-lg font-semibold text-ink">{turn.createdByUserName}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
        {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(turn.createdAt))}
      </p>
      <p className="mt-4 text-sm leading-7 text-slate-700">{turn.statementText}</p>

      {turn.videoAttachmentUrl ? (
        <details className="mt-4 rounded-[1.25rem] border border-slate-200 bg-white/85 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-civic-700">Watch explanation</summary>
          {isDirectVideoUrl(turn.videoAttachmentUrl) ? (
            <video controls preload="metadata" className="mt-4 w-full rounded-2xl border border-slate-200 bg-black">
              <source src={turn.videoAttachmentUrl} />
              Your browser does not support embedded video playback.
            </video>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p>This turn includes an external video explanation.</p>
              <a
                href={turn.videoAttachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                Open video
              </a>
            </div>
          )}
        </details>
      ) : null}

      {turn.citations.length ? (
        <details className="mt-4 rounded-[1.25rem] border border-slate-200 bg-white/85 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-civic-700">
            Citations · {turn.citations.length}
          </summary>
          <div className="mt-4 space-y-3">
            {turn.citations.map((citation) => (
              <div key={citation.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{citation.title}</p>
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {citation.sourceName}
                    {citation.sourceType ? ` · ${citation.sourceType}` : ""}
                  </span>
                </div>
                {citation.note ? <p className="mt-2 text-sm leading-6 text-slate-600">{citation.note}</p> : null}
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                >
                  View source
                </a>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <form action={reactToDebateTurn}>
          <input type="hidden" name="turnId" value={turn.id} />
          <input type="hidden" name="debateId" value={debateId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <input type="hidden" name="reaction" value="support" />
          <FormSubmitButton
            idleLabel={<ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>{`Support · ${turn.supportCount}`}</ActionLabel>}
            pendingLabel={<ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>Saving...</ActionLabel>}
            className={
              turn.viewerReaction === "support"
                ? "rounded-full bg-civic-500 px-4 py-2 text-sm font-semibold text-white"
              : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            }
          />
        </form>
        <form action={reactToDebateTurn}>
          <input type="hidden" name="turnId" value={turn.id} />
          <input type="hidden" name="debateId" value={debateId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <input type="hidden" name="reaction" value="oppose" />
          <FormSubmitButton
            idleLabel={<ActionLabel icon={<ThumbsDownIcon className="h-4 w-4" />}>{`Oppose · ${turn.opposeCount}`}</ActionLabel>}
            pendingLabel={<ActionLabel icon={<ThumbsDownIcon className="h-4 w-4" />}>Saving...</ActionLabel>}
            className={
              turn.viewerReaction === "oppose"
                ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-ink"
            }
          />
        </form>
      </div>

      <div className="mt-5">
        <TruthMeter meter={truthMeter} viewerRole={viewerRole} returnPath={returnPath} compact />
      </div>

      <section className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white/85 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Trusted Citizen fallacy tags</p>
            <p className="mt-2 text-sm text-slate-600">Community-flagged argument patterns on this statement. These tags are structured civic signals, not an official ruling.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {turn.totalFallacyTagCount} tag{turn.totalFallacyTagCount === 1 ? "" : "s"}
          </span>
        </div>

        {turn.fallacyTags.length ? (
          <div className="mt-4 space-y-3">
            {turn.fallacyTags.map((tag) => (
              <details key={tag.type} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink">
                  <span>{tag.type}</span>
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {tag.count} tag{tag.count === 1 ? "" : "s"}{tag.viewerTagged ? " · you tagged this" : ""}
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-600">{DEBATE_FALLACY_DEFINITIONS[tag.type]}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
                  <span className="rounded-full bg-white px-3 py-1 text-slate-700">{tag.status}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-slate-700">Agree {tag.agreeCount}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-slate-700">Disagree {tag.disagreeCount}</span>
                </div>
                {canTagFallacies && !tag.viewerTagged ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <form action={reviewDebateFallacyTag}>
                      <input type="hidden" name="debateId" value={debateId} />
                      <input type="hidden" name="turnId" value={turn.id} />
                      <input type="hidden" name="fallacyType" value={tag.type} />
                      <input type="hidden" name="position" value="agree" />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <FormSubmitButton
                        idleLabel={tag.viewerReview === "agree" ? "Agreed" : "Agree"}
                        pendingLabel="Saving..."
                        className={
                          tag.viewerReview === "agree"
                            ? "rounded-full bg-civic-600 px-3 py-2 text-xs font-semibold text-white"
                            : "rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                        }
                      />
                    </form>
                    <form action={reviewDebateFallacyTag}>
                      <input type="hidden" name="debateId" value={debateId} />
                      <input type="hidden" name="turnId" value={turn.id} />
                      <input type="hidden" name="fallacyType" value={tag.type} />
                      <input type="hidden" name="position" value="disagree" />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <FormSubmitButton
                        idleLabel={tag.viewerReview === "disagree" ? "Disagreed" : "Disagree"}
                        pendingLabel="Saving..."
                        className={
                          tag.viewerReview === "disagree"
                            ? "rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                            : "rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-ink"
                        }
                      />
                    </form>
                  </div>
                ) : null}
              </details>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No fallacy tags have been added to this turn yet.</p>
        )}

        {canTagFallacies ? (
          <form action={tagDebateTurnFallacy} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="debateId" value={debateId} />
            <input type="hidden" name="turnId" value={turn.id} />
            <input type="hidden" name="returnPath" value={returnPath} />
            {DEBATE_FALLACY_TYPES.map((type) => {
              const existingTag = turn.fallacyTags.find((tag) => tag.type === type);
              const viewerTagged = existingTag?.viewerTagged ?? false;

              return (
                <button
                  key={type}
                  type="submit"
                  name="fallacyType"
                  value={type}
                  className={
                    viewerTagged
                      ? "rounded-full bg-civic-600 px-3 py-2 text-xs font-semibold text-white"
                      : "rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                  }
                >
                  {type}
                </button>
              );
            })}
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Only Trusted Citizens can add fallacy tags to debate statements.</p>
        )}
      </section>
    </section>
  );
}
