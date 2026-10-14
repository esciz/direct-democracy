import { AiSummaryPanel } from "@/components/domain/ai-summary-panel";
import { ExplanationPanel } from "@/components/domain/explanation-panel";
import { ActionLabel, ScaleIcon } from "@/components/ui/action-icons";
import { canUserRateTruth } from "@/lib/auth/guards";
import { submitTruthRating } from "@/lib/truth/actions";
import { TRUTH_RATING_VALUES } from "@/lib/truth/ratings";
import type { TruthMeterSummary, UserRole } from "@/types/domain";

type TruthMeterProps = {
  meter: TruthMeterSummary;
  viewerRole: UserRole;
  returnPath: string;
  compact?: boolean;
  trustedCitizensOnly?: boolean;
  aiSummary?: {
    summary: string;
    bullets: string[];
  };
};

function toneClass(label: string) {
  if (label === "Accurate") {
    return "bg-emerald-500";
  }

  if (label === "Mostly True") {
    return "bg-civic-500";
  }

  if (label === "Mixed / Unclear") {
    return "bg-slate-400";
  }

  if (label === "Misleading") {
    return "bg-orange-500";
  }

  return "bg-rose-500";
}

export function TruthMeter({ meter, viewerRole, returnPath, compact = false, trustedCitizensOnly = false, aiSummary }: TruthMeterProps) {
  const canRate = trustedCitizensOnly ? viewerRole === "trustedCitizen" : canUserRateTruth({ role: viewerRole });

  return (
    <section className={`rounded-[1.5rem] border border-slate-200 bg-slate-50 ${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Community-rated accuracy</p>
          <p className="mt-2 text-sm text-slate-600">
            {trustedCitizensOnly
              ? "Trusted citizens can rate accuracy on a structured scale. The platform shows the distribution rather than one binary verdict."
              : "Trusted roles can rate accuracy on a structured scale. The platform shows the distribution rather than one binary verdict."}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          {meter.totalRatings} rating{meter.totalRatings === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {meter.distribution.map((entry) => (
          <div key={entry.label} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
              <span>{entry.label}</span>
              <span>
                {entry.count} · {entry.percentage}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div className={`h-2 rounded-full ${toneClass(entry.label)}`} style={{ width: `${Math.max(entry.percentage, entry.count ? 8 : 0)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {canRate ? (
        <form action={submitTruthRating} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="entityId" value={meter.entityId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          {TRUTH_RATING_VALUES.map((value) => (
            <button
              key={value}
              type="submit"
              name="rating"
              value={value}
              className={
                meter.viewerRating === value
                  ? "rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                  : "rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              }
            >
              <ActionLabel icon={<ScaleIcon className="h-3.5 w-3.5" />}>{value}</ActionLabel>
            </button>
          ))}
        </form>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          {trustedCitizensOnly
            ? "Trusted citizens can submit one structured truth rating here."
            : "Trusted citizens, candidates, and officials can submit one structured truth rating here."}
        </p>
      )}

      <div className="mt-4 space-y-4">
        <ExplanationPanel
          title="Truth Ratings explained"
          summary="Truth ratings apply only to factual claims and are community-driven, not official rulings."
          compact
        >
          <p>
            The scale runs from <strong>Accurate</strong>, <strong>Mostly True</strong>, and <strong>Mixed / Unclear</strong> to <strong>Misleading</strong> and <strong>False</strong>.
          </p>
          <p>
            These ratings help people see where the community thinks a factual claim is well-supported and where important context may still be missing or disputed.
          </p>
        </ExplanationPanel>
        {aiSummary ? <AiSummaryPanel summary={aiSummary.summary} bullets={aiSummary.bullets} compact /> : null}
      </div>
    </section>
  );
}
