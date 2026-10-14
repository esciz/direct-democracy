import Link from "next/link";

import { getFavoriteSpotCategoryLabel } from "@/lib/profile/options";
import type { CommunityFavoritePlaceSummary, FavoriteSpotType } from "@/types/domain";

type CommunityPopularPlacesProps = {
  places: CommunityFavoritePlaceSummary[];
  selectedCategory: FavoriteSpotType | "all";
  categoryLinks: Array<{
    label: string;
    href: string;
    active: boolean;
  }>;
};

export function CommunityPopularPlaces({ places, selectedCategory, categoryLinks }: CommunityPopularPlacesProps) {
  const grouped = places.reduce<Record<string, CommunityFavoritePlaceSummary[]>>((groups, place) => {
    const key = place.type;
    groups[key] = [...(groups[key] ?? []), place];
    return groups;
  }, {});

  const orderedGroups =
    selectedCategory === "all"
      ? Object.entries(grouped)
      : Object.entries(grouped).filter(([category]) => category === selectedCategory);

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">Popular places</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">What places define local life here</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Pulled from structured favorite-place entries on user profiles so the page feels social, local, and grounded in everyday life.
          </p>
        </div>
        <Link href="/profile" className="text-sm font-semibold text-civic-700 transition hover:text-civic-900">
          Update your places
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {categoryLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              link.active
                ? "rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                : "rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            }
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {orderedGroups.length ? (
          orderedGroups.map(([category, categoryPlaces]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-lg font-semibold text-ink">{getFavoriteSpotCategoryLabel(category as FavoriteSpotType)}</h3>
              <div className="grid gap-4 xl:grid-cols-2">
                {categoryPlaces.map((place) => (
                  <article key={`${place.name}-${place.type}`} className="rounded-3xl bg-slate-50 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
                        {place.popularityCount} mention{place.popularityCount === 1 ? "" : "s"}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                        {getFavoriteSpotCategoryLabel(place.type as FavoriteSpotType)}
                      </span>
                    </div>
                    <h4 className="mt-3 text-lg font-semibold text-ink">{place.name}</h4>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                      {place.contributorNames.slice(0, 3).join(" · ")}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">
            No popular places have been saved for this category yet.
          </div>
        )}
      </div>
    </section>
  );
}
