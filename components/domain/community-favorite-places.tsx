import Link from "next/link";

import { getFavoriteSpotCategoryLabel } from "@/lib/profile/options";
import { getPlaceVisualToken } from "@/lib/ui/visual-tokens";
import type { CommunityFavoritePlaceSummary } from "@/types/domain";

type CommunityFavoritePlacesProps = {
  places: CommunityFavoritePlaceSummary[];
};

export function CommunityFavoritePlaces({ places }: CommunityFavoritePlacesProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">Favorite places</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Community favorite places</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Places people in this community actually mention on their profiles, surfaced to make the dashboard feel more local and human.
          </p>
        </div>
        <Link href="/profile" className="text-sm font-semibold text-civic-700 hover:text-civic-900">
          Add your places
        </Link>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {places.length ? (
          places.map((place) => (
            <article key={`${place.name}-${place.type}`} className="rounded-3xl bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-lg ring-1 ring-slate-200"
                  title={place.type === "activity" ? "Activity" : getFavoriteSpotCategoryLabel(place.type)}
                  aria-label={place.type === "activity" ? "Activity" : getFavoriteSpotCategoryLabel(place.type)}
                >
                  {getPlaceVisualToken(place.type, place.type === "activity" ? "Activity" : getFavoriteSpotCategoryLabel(place.type)).icon}
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
                    {place.type === "activity" ? "Activity" : getFavoriteSpotCategoryLabel(place.type)}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-ink">{place.name}</h3>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {place.popularityCount} profile mention{place.popularityCount === 1 ? "" : "s"}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                {place.contributorNames.slice(0, 3).join(" · ")}
              </p>
            </article>
          ))
        ) : (
          <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-3">
            Favorite places will appear here as people add them to their profiles.
          </div>
        )}
      </div>
    </section>
  );
}
