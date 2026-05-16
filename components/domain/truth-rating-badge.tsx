import type { PoliticalAdRatingConfidence, PoliticalAdTruthRating } from "@/types/domain";

type TruthRatingBadgeProps = {
  label: string;
  rating?: PoliticalAdTruthRating | null;
  confidence?: PoliticalAdRatingConfidence | null;
  tone?: "system" | "citizen";
};

function getRatingClass(rating?: PoliticalAdTruthRating | null) {
  switch (rating) {
    case "True":
    case "Mostly True":
      return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
    case "Mostly False":
    case "False":
      return "border-rose-300/20 bg-rose-500/10 text-rose-100";
    case "Not Checkable":
      return "border-slate-300/16 bg-white/[0.05] text-slate-200";
    case "Needs Review":
    default:
      return "border-amber-300/20 bg-amber-500/10 text-amber-100";
  }
}

export function TruthRatingBadge({ label, rating, confidence, tone = "system" }: TruthRatingBadgeProps) {
  return (
    <div className={`rounded-2xl border px-3 py-2 ${getRatingClass(rating)}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-1 text-sm font-semibold">{rating ?? "Needs Review"}</p>
      {confidence ? <p className="mt-0.5 text-[11px] opacity-75">{tone === "system" ? `${confidence} confidence` : "Trusted citizen review"}</p> : null}
    </div>
  );
}
