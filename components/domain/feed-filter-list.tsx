"use client";

import { Children, useMemo, useState, type ReactNode } from "react";

type FeedScopeFilter = "all" | "local" | "state" | "national";
type FeedTypeFilter = "all" | "post" | "poll" | "petition" | "debate" | "event" | "media";

type FeedFilterItemMeta = {
  id: string;
  type: FeedTypeFilter;
  scope: FeedScopeFilter;
  jurisdictionName?: string;
};

type FeedFilterListProps = {
  initialScope: FeedScopeFilter[];
  initialType?: FeedTypeFilter[];
  initialCommunity?: string;
  items: FeedFilterItemMeta[];
  children: ReactNode;
};

const scopeOptions: Array<{ value: FeedScopeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "local", label: "Local" },
  { value: "state", label: "State" },
  { value: "national", label: "National" },
];

const typeOptions: Array<{ value: FeedTypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "post", label: "Posts" },
  { value: "poll", label: "Polls" },
  { value: "petition", label: "Petitions" },
  { value: "debate", label: "Debates" },
  { value: "event", label: "Events" },
  { value: "media", label: "News" },
];

function pillClass(active: boolean) {
  return active
    ? "inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
    : "inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700";
}

function normalizeSelection<T extends "all" | string>(values: T[]) {
  if (!values.length || values.includes("all" as T)) {
    return ["all" as T];
  }

  return [...new Set(values)];
}

function toggleSelection<T extends "all" | string>(current: T[], value: T) {
  if (value === "all") {
    return ["all" as T];
  }

  const base = current.includes("all" as T) ? [] : current;
  const next = base.includes(value) ? base.filter((entry) => entry !== value) : [...base, value];

  return next.length ? next : ["all" as T];
}

export function FeedFilterList({ initialScope, initialType = ["all"], initialCommunity, items, children }: FeedFilterListProps) {
  const [scope, setScope] = useState<FeedScopeFilter[]>(normalizeSelection(initialScope));
  const [type, setType] = useState<FeedTypeFilter[]>(normalizeSelection(initialType));
  const renderedChildren = useMemo(() => Children.toArray(children), [children]);
  const allowedCommunities = initialCommunity ? new Set(initialCommunity.split("|").filter(Boolean)) : null;

  const visibleIndexes = items.reduce<number[]>((indexes, item, index) => {
    const scopeMatches = scope.includes("all") || scope.includes(item.scope);
    const typeMatches = type.includes("all") || type.includes(item.type);
    const communityMatches = !allowedCommunities || (item.jurisdictionName ? allowedCommunities.has(item.jurisdictionName) : false);

    if (scopeMatches && typeMatches && communityMatches) {
      indexes.push(index);
    }

    return indexes;
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Scope</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scopeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScope((current) => toggleSelection(current, option.value))}
                  className={pillClass(scope.includes(option.value))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Content Type</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {typeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType((current) => toggleSelection(current, option.value))}
                  className={pillClass(type.includes(option.value))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {visibleIndexes.length ? (
        <div className="space-y-5">{visibleIndexes.map((index) => <div key={items[index]?.id ?? index}>{renderedChildren[index]}</div>)}</div>
      ) : (
        <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 shadow-card">
          No feed items match your current filters.
        </section>
      )}
    </div>
  );
}
