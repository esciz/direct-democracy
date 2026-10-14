import Link from "next/link";

import { RecommendedDebatePanel } from "@/components/domain/recommended-debate-panel";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getUserCivicActivityCollection } from "@/lib/server/profile-activity";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "post", label: "Posts" },
  { key: "debate", label: "Debates" },
  { key: "petition", label: "Petitions" },
  { key: "event", label: "Events" },
  { key: "interview", label: "Interviews" },
  { key: "endorsement", label: "Endorsements" },
  { key: "caseContribution", label: "Case Contributions" },
] as const;

type ProfileActivityPageProps = {
  searchParams?: Promise<{
    type?: string;
  }>;
};

export default async function ProfileActivityPage({ searchParams }: ProfileActivityPageProps) {
  const currentUser = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const selectedType = FILTERS.some((entry) => entry.key === params?.type) ? (params?.type as (typeof FILTERS)[number]["key"]) : "all";
  const activity = await getUserCivicActivityCollection(currentUser.id).catch(() => null);
  const items = activity
    ? selectedType === "all"
      ? activity.allItems
      : activity.allItems.filter((item) => item.kind === selectedType)
    : [];

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Profile Activity"
        title="Your public civic activity"
        description="A filtered record of your public contributions across posts, debates, petitions, events, interviews, endorsements, and case work."
        actions={
          <Link
            href="/profile"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to Profile
          </Link>
        }
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const href = filter.key === "all" ? "/profile/activity" : `/profile/activity?type=${encodeURIComponent(filter.key)}`;
            const active = selectedType === filter.key;

            return (
              <Link
                key={filter.key}
                href={href}
                scroll={false}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {FILTERS.filter((entry) => entry.key !== "all").map((entry) => (
            <div key={entry.key} className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{entry.label}</p>
              <p className="mt-2 text-lg font-semibold text-ink">{activity?.counts[entry.key] ?? 0}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Activity Record</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">
            {selectedType === "all" ? "All public activity" : FILTERS.find((entry) => entry.key === selectedType)?.label}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            This page keeps the full activity history separate from the main profile so the core profile route stays fast and readable.
          </p>
        </div>

        {items.length ? (
          <div className="mt-6 space-y-3">
            {items.map((item) => (
              <Link
                key={`${item.kind}-${item.id}`}
                href={item.href}
                className="block rounded-3xl bg-slate-50 p-4 transition hover:bg-civic-50/50"
              >
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{item.meta}</span>
                <p className="mt-3 text-base font-semibold text-ink">{item.title}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
            No public activity is available for this filter yet.
          </div>
        )}
      </section>

      {selectedType === "all" || selectedType === "debate" ? (
        <RecommendedDebatePanel
          title="Recommended next debates"
          description="These prompts sit below your debate activity so the next structured civic conversation feels connected to what you have already contributed."
          recommendations={activity?.recommendedDebates ?? []}
          compact
        />
      ) : null}
    </div>
  );
}
