import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";
import { PreserveScrollQueryForm } from "@/components/ui/preserve-scroll-query-form";
import { getCampusCommunities } from "@/lib/community/communities";

type CampusesPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

function matchesQuery(query: string, ...values: Array<string | null | undefined>) {
  if (!query) {
    return true;
  }

  const normalized = query.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

export default async function CampusesPage({ searchParams }: CampusesPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const query = params?.q?.trim() ?? "";
  const campuses = getCampusCommunities().filter((campus) =>
    matchesQuery(query, campus.name, campus.shortName, campus.descriptor, campus.locationLabel ?? ""),
  );

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Campus Communities"
        title="Browse campus communities"
        description="University and college communities stay separate from city and state views while still plugging into the same civic tools. Anyone can browse them; Student-Verified users can associate themselves with a campus and unlock student-specific controls."
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
        <PreserveScrollQueryForm action="/campuses" className="flex flex-wrap gap-3">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search campuses by name"
            className="min-w-[18rem] rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          />
          <button type="submit" className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            Search
          </button>
        </PreserveScrollQueryForm>
      </section>

      <section className="grid gap-4">
        {campuses.map((campus) => (
          <article key={campus.id} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Campus community</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{campus.name}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{campus.descriptor}</p>
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  {campus.institutionType} institution
                  {campus.locationLabel ? ` · ${campus.locationLabel}` : ""}
                  {campus.enrollmentSize ? ` · ${campus.enrollmentSize.toLocaleString()} students` : ""}
                </p>
              </div>
              <Link
                href={`/campuses/${campus.id}`}
                className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open campus
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
