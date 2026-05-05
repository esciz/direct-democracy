import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getSafeReputationSummary, getUserReputationSignals } from "@/lib/profile/reputation";
import { getInterviewRequestsForPublicProfile } from "@/lib/server/interviews";
import { getAllPublicProfiles } from "@/lib/server/elections-context";

const TIER_EXPLANATIONS = [
  {
    tier: "Highly Trusted",
    description: "A strong public record with consistently constructive signals and relatively few negative patterns.",
  },
  {
    tier: "Trusted",
    description: "A generally credible public record with more positive signals than negative ones.",
  },
  {
    tier: "Mixed Reliability",
    description: "Some signals are positive, but truth, debate quality, or consistency indicators are still mixed.",
  },
  {
    tier: "Low Reliability",
    description: "Negative truth or integrity patterns are outweighing the positive signals right now.",
  },
] as const;

export default async function ProfileReputationPage() {
  const currentUser = await getCurrentUser();
  const safeSummary = getSafeReputationSummary(currentUser);
  const [signals, profiles] = await Promise.all([
    getUserReputationSignals(currentUser.id, { baseFollowerCount: currentUser.followerCount }).catch(() => null),
    getAllPublicProfiles().catch(() => []),
  ]);
  const linkedProfile = profiles.find((profile) => profile.claimedByUserId === currentUser.id);
  const interviews = linkedProfile ? await getInterviewRequestsForPublicProfile(linkedProfile.id).catch(() => null) : null;

  const trustedBreakdown = signals?.trustedCitizenReputation?.breakdown ?? null;
  const contributionCards = [
    {
      title: "Truth signals",
      value: signals?.trustLevel ?? safeSummary.label,
      description: signals?.trustSummary ?? safeSummary.summary,
    },
    {
      title: "Public reach",
      value: signals?.influenceLevel ?? "Emerging",
      description: signals?.influenceSummary ?? "Audience and engagement remain a secondary signal, not the whole score.",
    },
    {
      title: "Interview responsiveness",
      value: interviews?.responsiveness.signalLabel ?? "Not yet established",
      description: interviews?.responsiveness.signalDescription ?? "Interview participation becomes visible here when it exists.",
    },
  ];

  const plainLanguageBreakdown = trustedBreakdown
    ? [
        {
          title: "Truth and statement quality",
          value: `${trustedBreakdown.truth}/100`,
          description: "This reflects how public statements and claims have been rated when the platform has enough truth-review data.",
        },
        {
          title: "Debate quality and integrity",
          value: `${trustedBreakdown.debate}/100`,
          description: "This reflects debate participation, constructive outcomes, citations, and integrity-related penalties such as supported fallacy tags.",
        },
        {
          title: "Community trust baseline",
          value: `${trustedBreakdown.communityTrust}/100`,
          description: "This reflects verification status and broader community trust patterns, without exposing the heavier follower qualification math here.",
        },
      ]
    : [];

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Reputation Details"
        title="How your current reputation summary is being interpreted"
        description="This page explains the current tier in plain language and shows the main types of public signals that are helping or hurting it."
        actions={
          <Link
            href="/profile"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to Profile
          </Link>
        }
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Current Tier</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{safeSummary.tier}</h2>
            <p className="mt-2 text-sm text-slate-600">{safeSummary.summary}</p>
          </div>
          <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">{safeSummary.label}</span>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Tier Guide</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {TIER_EXPLANATIONS.map((entry) => (
            <article key={entry.tier} className={`rounded-3xl p-5 ${entry.tier === safeSummary.tier ? "bg-civic-50 text-civic-950" : "bg-slate-50 text-slate-700"}`}>
              <h3 className="text-lg font-semibold">{entry.tier}</h3>
              <p className="mt-2 text-sm leading-7">{entry.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Main Contributing Signals</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {contributionCards.map((card) => (
            <article key={card.title} className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{card.title}</p>
              <p className="mt-2 text-lg font-semibold text-ink">{card.value}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">What Helped or Hurt</p>
        {plainLanguageBreakdown.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {plainLanguageBreakdown.map((entry) => (
              <article key={entry.title} className="rounded-3xl bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{entry.title}</p>
                <p className="mt-2 text-lg font-semibold text-ink">{entry.value}</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{entry.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm leading-7 text-slate-600">
            A deeper quantitative breakdown is not available for this account yet, but the platform still shows the main signals that shape the current tier: public statement quality, debate integrity, community trust context, and interview responsiveness where applicable.
          </div>
        )}
      </section>
    </div>
  );
}
