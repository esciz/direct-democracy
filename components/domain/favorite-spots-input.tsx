"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

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
  const visibleRows = Math.min(maxItems, Math.max(1, spots.length + (spots.length < maxItems ? 1 : 0)));
  return Array.from({ length: visibleRows }, (_, index) => ({
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
        <p className="mt-1 text-xs leading-5 text-slate-400">Optional local favorites.</p>
      </div>
      <input type="hidden" name={inputName} value={serializedValue} />
      <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
        {rows.map((row, index) => (
          <div key={`${inputName}-${index}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_2rem] gap-2 py-2.5">
            <div className="grid min-w-0 gap-2 md:grid-cols-[11rem_minmax(0,1fr)]">
              <select
                aria-label={`Favorite place ${index + 1} category`}
                value={row.category}
                onChange={(event) => {
                  const nextRows = [...rows];
                  nextRows[index] = { ...row, category: event.target.value };
                  setRows(nextRows);
                }}
                className="h-10 w-full min-w-0 rounded-md border border-white/12 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
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
                className="h-10 w-full min-w-0 rounded-md border border-white/12 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (rows.length === 1) {
                  setRows([{ category: "", name: "" }]);
                  return;
                }
                setRows(rows.filter((_, rowIndex) => rowIndex !== index));
              }}
              className="flex h-10 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
              aria-label={`Remove favorite place ${index + 1}`}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      {rows.length < maxItems ? (
        <button
          type="button"
          onClick={() => setRows([...rows, { category: "", name: "" }])}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/10"
        >
          <Plus size={14} />
          Add a place
        </button>
      ) : null}
    </div>
  );
}
