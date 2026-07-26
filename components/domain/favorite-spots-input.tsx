"use client";

import { useMemo, useState } from "react";

import { FAVORITE_SPOT_CATEGORY_OPTIONS } from "@/lib/profile/options";
import type { FavoriteSpotSummary } from "@/types/domain";

type FavoriteSpotsInputProps = {
  inputName: string;
  spots: FavoriteSpotSummary[];
  maxItems?: number;
};

type RowState = {
  category: string;
  name: string;
};

function buildInitialRows(spots: FavoriteSpotSummary[], maxItems: number): RowState[] {
  return Array.from({ length: maxItems }, (_, index) => ({
    category: spots[index]?.category ?? "",
    name: spots[index]?.name ?? "",
  }));
}

export function FavoriteSpotsInput({ inputName, spots, maxItems = 4 }: FavoriteSpotsInputProps) {
  const [rows, setRows] = useState<RowState[]>(() => buildInitialRows(spots, maxItems));

  const serializedValue = useMemo(
    () =>
      JSON.stringify(
        rows.flatMap((row, index) => {
          const category = row.category.trim();
          const name = row.name.trim();

          if (!category || !name) {
            return [];
          }

          return [
            {
              id: `favorite_spot_${index}_${category}`,
              category,
              name,
            },
          ];
        }),
      ),
    [rows],
  );

  return (
    <div className="min-w-0">
      <div>
        <p className="text-sm font-semibold text-slate-100">Favorite places</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">Share a few places that help neighbors understand your community.</p>
      </div>
      <input type="hidden" name={inputName} value={serializedValue} />
      <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
        {rows.map((row, index) => (
          <div key={`${inputName}-${index}`} className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 py-3">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-xs font-semibold text-slate-400"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="grid min-w-0 gap-2 md:grid-cols-[12rem_minmax(0,1fr)]">
              <select
                aria-label={`Favorite place ${index + 1} category`}
                value={row.category}
                onChange={(event) => {
                  const nextRows = [...rows];
                  nextRows[index] = { ...row, category: event.target.value };
                  setRows(nextRows);
                }}
                className="min-h-11 w-full min-w-0 rounded-lg border border-white/12 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
              >
                <option value="">Choose category</option>
                {FAVORITE_SPOT_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Favorite place ${index + 1} name`}
                value={row.name}
                onChange={(event) => {
                  const nextRows = [...rows];
                  nextRows[index] = { ...row, name: event.target.value };
                  setRows(nextRows);
                }}
                placeholder="Place name"
                className="min-h-11 w-full min-w-0 rounded-lg border border-white/12 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
