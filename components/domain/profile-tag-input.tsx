"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { PREDEFINED_PROFILE_TAG_OPTIONS, PROFILE_TAG_CATEGORY_OPTIONS, getProfileTagCategoryLabel } from "@/lib/profile/options";
import type { ProfileTagCategory, ProfileTagSummary } from "@/types/domain";

type ProfileTagInputProps = {
  inputName: string;
  tags: ProfileTagSummary[];
  maxItems?: number;
};

type RowState = {
  category: ProfileTagCategory | "";
  option: string;
  custom: string;
  isPublic: boolean;
};

function buildInitialRows(tags: ProfileTagSummary[], maxItems: number): RowState[] {
  const visibleRows = Math.min(maxItems, Math.max(1, tags.length + (tags.length < maxItems ? 1 : 0)));
  return Array.from({ length: visibleRows }, (_, index) => {
    const tag = tags[index];

    if (!tag) {
      return { category: "", option: "", custom: "", isPublic: false };
    }

    const options = PREDEFINED_PROFILE_TAG_OPTIONS[tag.category] ?? [];

    return tag.isCustom || !options.includes(tag.value)
      ? { category: tag.category, option: "__custom__", custom: tag.value, isPublic: tag.isPublic }
      : { category: tag.category, option: tag.value, custom: "", isPublic: tag.isPublic };
  });
}

export function ProfileTagInput({ inputName, tags, maxItems = 6 }: ProfileTagInputProps) {
  const [rows, setRows] = useState<RowState[]>(() => buildInitialRows(tags, maxItems));

  const serializedValue = useMemo(
    () =>
      JSON.stringify(
        rows.flatMap((row) => {
          if (!row.category) {
            return [];
          }

          const value = row.option === "__custom__" ? row.custom.trim() : row.option.trim();

          if (!value) {
            return [];
          }

          return [
            {
              category: row.category,
              value,
              isCustom: row.option === "__custom__",
              isPublic: row.isPublic,
            },
          ];
        }),
      ),
    [rows],
  );

  return (
    <div className="min-w-0">
      <div>
        <p className="text-sm font-semibold text-slate-100">About you</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">Optional. Add only what you want to share.</p>
      </div>
      <input type="hidden" name={inputName} value={serializedValue} />
      <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
        {rows.map((row, index) => {
          const options = row.category ? PREDEFINED_PROFILE_TAG_OPTIONS[row.category] : [];

          return (
            <div key={`${inputName}-${index}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_2rem] gap-2 py-2.5">
              <div className="grid min-w-0 gap-2 lg:grid-cols-[10rem_minmax(0,1fr)_auto]">
                <select
                  value={row.category}
                  onChange={(event) => {
                    const nextCategory = event.target.value as ProfileTagCategory | "";
                    const nextRows = [...rows];
                    nextRows[index] = {
                      category: nextCategory,
                      option: "",
                      custom: "",
                      isPublic: row.isPublic,
                    };
                    setRows(nextRows);
                  }}
                  className="h-10 w-full min-w-0 rounded-md border border-white/12 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                  aria-label={`Select category for tag ${index + 1}`}
                >
                  <option value="">Choose category</option>
                  {PROFILE_TAG_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className={row.option === "__custom__" ? "grid min-w-0 gap-2 sm:grid-cols-2" : "min-w-0"}>
                  <select
                    value={row.option}
                    onChange={(event) => {
                      const nextRows = [...rows];
                      nextRows[index] = {
                        ...row,
                        option: event.target.value,
                        custom: event.target.value === "__custom__" ? row.custom : "",
                      };
                      setRows(nextRows);
                    }}
                    disabled={!row.category}
                    className="h-10 w-full min-w-0 rounded-md border border-white/12 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none disabled:cursor-not-allowed disabled:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                    aria-label={
                      row.category
                        ? `Select a ${getProfileTagCategoryLabel(row.category).toLowerCase()} tag`
                        : `Select a tag option`
                    }
                  >
                    <option value="">{row.category ? "Select an option" : "Choose a category first"}</option>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value="__custom__">Other / Custom</option>
                  </select>
                  {row.option === "__custom__" ? (
                    <input
                      value={row.custom}
                      onChange={(event) => {
                        const nextRows = [...rows];
                        nextRows[index] = {
                          ...row,
                          option: "__custom__",
                          custom: event.target.value,
                        };
                        setRows(nextRows);
                      }}
                      placeholder="Write in your own"
                      className="h-10 w-full min-w-0 rounded-md border border-white/12 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                    />
                  ) : null}
                </div>
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-white/10 px-2.5 text-xs font-semibold text-slate-400 transition hover:border-white/20 hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={row.isPublic}
                    onChange={(event) => {
                      const nextRows = [...rows];
                      nextRows[index] = { ...row, isPublic: event.target.checked };
                      setRows(nextRows);
                    }}
                    className="h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400"
                  />
                  Public
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (rows.length === 1) {
                    setRows([{ category: "", option: "", custom: "", isPublic: false }]);
                    return;
                  }
                  setRows(rows.filter((_, rowIndex) => rowIndex !== index));
                }}
                className="flex h-10 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
                aria-label={`Remove profile detail ${index + 1}`}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
      {rows.length < maxItems ? (
        <button
          type="button"
          onClick={() => setRows([...rows, { category: "", option: "", custom: "", isPublic: false }])}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/10"
        >
          <Plus size={14} />
          Add a detail
        </button>
      ) : null}
    </div>
  );
}
