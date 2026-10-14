"use client";

import { useState } from "react";

import { ActionLabel, ThumbsDownIcon, ThumbsUpIcon } from "@/components/ui/action-icons";

type ReactionBarProps = {
  initialUp: number;
  initialDown: number;
};

export function ReactionBar({ initialUp, initialDown }: ReactionBarProps) {
  const [selection, setSelection] = useState<"up" | "down" | null>(null);
  const [counts, setCounts] = useState({ up: initialUp, down: initialDown });

  function handleReact(nextSelection: "up" | "down") {
    setCounts((current) => {
      const nextCounts = { ...current };

      if (selection === nextSelection) {
        nextCounts[nextSelection] -= 1;
        setSelection(null);
        return nextCounts;
      }

      if (selection) {
        nextCounts[selection] -= 1;
      }

      nextCounts[nextSelection] += 1;
      setSelection(nextSelection);
      return nextCounts;
    });
  }

  return (
    <div className="mt-5 flex items-center gap-3">
      <button
        type="button"
        onClick={() => handleReact("up")}
        aria-pressed={selection === "up"}
        aria-label={`Support ${counts.up}`}
        className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
          selection === "up" ? "bg-civic-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }`}
      >
        <ActionLabel icon={<ThumbsUpIcon />}>{counts.up}</ActionLabel>
      </button>
      <button
        type="button"
        onClick={() => handleReact("down")}
        aria-pressed={selection === "down"}
        aria-label={`Oppose ${counts.down}`}
        className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
          selection === "down" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }`}
      >
        <ActionLabel icon={<ThumbsDownIcon />}>{counts.down}</ActionLabel>
      </button>
    </div>
  );
}
