import type { InfluenceLevel, TrustLevel } from "@/types/domain";

type ReputationBadgesProps = {
  trustLevel: TrustLevel;
  influenceLevel: InfluenceLevel;
  compact?: boolean;
};

function getTrustTone(trustLevel: TrustLevel) {
  switch (trustLevel) {
    case "High Trust":
      return "bg-emerald-50 text-emerald-700";
    case "Moderate Trust":
      return "bg-civic-50 text-civic-700";
    case "Mixed":
      return "bg-slate-100 text-slate-700";
    case "Low Trust":
      return "bg-orange-50 text-orange-700";
  }
}

function getInfluenceTone(influenceLevel: InfluenceLevel) {
  switch (influenceLevel) {
    case "High Influence":
      return "bg-violet-50 text-violet-700";
    case "Moderate Influence":
      return "bg-indigo-50 text-indigo-700";
    case "Emerging":
      return "bg-slate-100 text-slate-700";
  }
}

export function ReputationBadges({ trustLevel, influenceLevel, compact = false }: ReputationBadgesProps) {
  const sizeClasses = compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs";

  return (
    <div className="flex flex-wrap gap-2">
      <span className={`rounded-full font-semibold ${sizeClasses} ${getTrustTone(trustLevel)}`}>Trust · {trustLevel}</span>
      <span className={`rounded-full font-semibold ${sizeClasses} ${getInfluenceTone(influenceLevel)}`}>
        Influence · {influenceLevel}
      </span>
    </div>
  );
}
