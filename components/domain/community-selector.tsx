"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { getCommunityPageHref, seededCommunities } from "@/lib/community/communities";
import type { CommunitySummary } from "@/types/domain";

type CommunitySelectorProps = {
  currentCommunity: CommunitySummary;
  followedCommunities: CommunitySummary[];
  suggestedCommunities: CommunitySummary[];
  followedIds: string[];
  returnPath: string;
  destinationBase?: string;
};

function getTypeLabel(community: CommunitySummary): "USA" | "State" | "County" | "City" | "Campus" {
  if (community.communityType === "campus") {
    return "Campus";
  }

  if (community.scope === "national") {
    return "USA";
  }

  if (community.scope === "state") {
    return "State";
  }

  if (community.id.endsWith("-county")) {
    return "County";
  }

  return "City";
}

export function CommunitySelector({ currentCommunity }: CommunitySelectorProps) {
  const [query, setQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? seededCommunities
        .filter((community) =>
          `${community.name} ${community.shortName} ${community.descriptor} ${community.locationLabel ?? ""}`
            .toLowerCase()
            .includes(normalized),
        )
        .slice(0, 8)
    : seededCommunities.slice(0, 6);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    inputRef.current?.focus();

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isExpanded]);

  return (
    <section ref={containerRef} className="rounded-[1.75rem] border border-white/70 bg-white/90 shadow-card backdrop-blur">
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex w-full flex-wrap items-center justify-between gap-4 p-5 text-left transition hover:bg-white/95"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Search Communities</p>
            <p className="mt-2 text-sm text-slate-600">Switch to a city, county, state, or campus community.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
              Search communities
            </span>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              Current: {currentCommunity.name}
            </span>
          </div>
        </button>
      ) : (
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Search Communities</p>
              <p className="mt-2 text-sm text-slate-600">Search cities, counties, states, and campus communities, then jump straight to that place page.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                Current: {currentCommunity.name}
              </span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
              >
                Close
              </button>
            </div>
          </div>

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsExpanded(true)}
            placeholder="Search communities"
            className="w-full rounded-full border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 outline-none transition focus:border-civic-500"
          />

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {filtered.length ? (
              filtered.map((community) => (
                <Link
                  key={community.id}
                  href={getCommunityPageHref(community.id)}
                  onClick={() => setIsExpanded(false)}
                  className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 text-sm transition last:border-b-0 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-semibold text-ink">{community.name}</p>
                    <p className="mt-1 text-slate-600">{community.descriptor}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                    {getTypeLabel(community)}
                  </span>
                </Link>
              ))
            ) : (
              <div className="px-4 py-5 text-sm text-slate-600">No matching communities yet.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
