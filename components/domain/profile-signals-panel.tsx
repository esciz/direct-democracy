import type { ProfileSignalsSummary } from "@/types/domain";

export type ProfileSignalCardDescriptor = {
  label: string;
  value: string;
  score?: number | null;
};

type ProfileSignalsPanelProps = {
  signals: ProfileSignalsSummary;
  cards?: ProfileSignalCardDescriptor[];
};

type SignalScaleConfig = {
  stops: string[];
  position: number;
  tone: "slate" | "civic" | "orange";
};

function getScaleConfig(label: string, value: string): SignalScaleConfig {
  if (label === "Ideological Leaning") {
    const stops = ["Left", "Center", "Right"];
    const positions: Record<string, number> = {
      Left: 0,
      "Lean Left": 24,
      Center: 50,
      "Lean Right": 76,
      Right: 100,
    };

    return {
      stops,
      position: positions[value] ?? 50,
      tone: "civic",
    };
  }

  if (label === "Public Reliability") {
    const stops = ["Weak", "Solid", "Strong"];
    const positions: Record<string, number> = {
      "Still Forming": 14,
      Mixed: 42,
      Solid: 68,
      High: 92,
    };

    return {
      stops,
      position: positions[value] ?? 42,
      tone: "civic",
    };
  }

  const stops = ["Challenged", "Mixed", "Accurate"];
  const positions: Record<string, number> = {
    "Often Challenged": 12,
    "Limited Ratings": 34,
    Mixed: 58,
    "Mostly Accurate": 88,
  };

  return {
    stops,
    position: positions[value] ?? 34,
    tone: "orange",
  };
}

function SignalScale({ label, value }: { label: string; value: string }) {
  const { stops, position, tone } = getScaleConfig(label, value);
  const trackTone =
    tone === "civic"
      ? "from-civic-100 via-civic-300 to-civic-600"
      : tone === "orange"
        ? "from-orange-100 via-amber-300 to-orange-500"
        : "from-slate-200 via-slate-400 to-slate-700";
  const markerTone =
    tone === "civic"
      ? "border-civic-700 bg-civic-600 shadow-civic-200/80"
      : tone === "orange"
        ? "border-orange-700 bg-orange-500 shadow-orange-200/80"
        : "border-slate-700 bg-slate-700 shadow-slate-300/80";
  const stopTone =
    tone === "civic"
      ? "text-civic-700"
      : tone === "orange"
        ? "text-orange-700"
        : "text-slate-600";

  return (
    <div className="mt-4 space-y-2">
      <div className={`relative h-2.5 rounded-full bg-gradient-to-r ${trackTone}`}>
        <div
          className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${markerTone} shadow-[0_0_0_4px_rgba(255,255,255,0.92)]`}
          style={{ left: `${position}%` }}
        />
      </div>
      <div className={`grid grid-cols-3 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] ${stopTone}`}>
        {stops.map((stop, index) => (
          <span
            key={stop}
            className={index === 0 ? "text-left" : index === 1 ? "text-center" : "text-right"}
          >
            {stop}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatSignalScore(label: string, score?: number | null) {
  if (typeof score !== "number") {
    return null;
  }

  if (label === "Ideological Leaning") {
    return `Position score ${score > 0 ? "+" : ""}${score.toFixed(1)}`;
  }

  return `${Math.round(score)}/100`;
}

function SignalCard({
  label,
  value,
  score,
}: {
  label: string;
  value: string;
  score?: number | null;
}) {
  const scoreLabel = formatSignalScore(label, score);

  return (
    <div className="flex h-full min-w-0 flex-col rounded-[1.4rem] border border-slate-200 bg-white/95 p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.5)]">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <p className="mt-3 text-xl font-semibold leading-tight text-ink">{value}</p>
        <SignalScale label={label} value={value} />
        {scoreLabel ? (
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{scoreLabel}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ProfileSignalsPanel({ signals, cards }: ProfileSignalsPanelProps) {
  const signalCards =
    cards ??
    [
      {
        label: "Ideological Leaning",
        value: signals.ideologicalLeaning.label,
        score: signals.ideologicalLeaning.score,
      },
      {
        label: "Public Reliability",
        value: signals.civicCredibility.label,
        score: signals.civicCredibility.score,
      },
      {
        label: "Truth Meter",
        value: signals.truthRecord.label,
        score: signals.truthRecord.score,
      },
    ];
  const gridClass =
    signalCards.length === 1 ? "xl:grid-cols-1" : signalCards.length === 2 ? "xl:grid-cols-2" : "xl:grid-cols-3";

  return (
    <div className="rounded-[1.6rem] border border-slate-200 bg-white/88 p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.42)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Profile Signals</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{signals.transparencyNote}</p>
        </div>
      </div>
      <div className={`mt-5 grid gap-4 ${gridClass}`}>
        {signalCards.map((card) => (
          <SignalCard key={card.label} label={card.label} value={card.value} score={card.score} />
        ))}
      </div>
    </div>
  );
}
