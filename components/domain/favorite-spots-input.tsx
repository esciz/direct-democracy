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
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-medium text-ink">Favorite places</p>
        <p className="mt-1 text-xs text-slate-500">One place per category. Reusing a category replaces the previous entry.</p>
      </div>
      <input type="hidden" name={inputName} value={serializedValue} />
      <div className="grid gap-3">
        {rows.map((row, index) => (
          <div key={`${inputName}-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-3 md:grid-cols-[15rem,minmax(0,1fr)]">
              <select
                value={row.category}
                onChange={(event) => {
                  const nextRows = [...rows];
                  nextRows[index] = { ...row, category: event.target.value };
                  setRows(nextRows);
                }}
                className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              >
                <option value="">Choose category</option>
                {FAVORITE_SPOT_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                value={row.name}
                onChange={(event) => {
                  const nextRows = [...rows];
                  nextRows[index] = { ...row, name: event.target.value };
                  setRows(nextRows);
                }}
                placeholder="Write in a place name"
                className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
