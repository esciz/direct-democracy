import Link from "next/link";

import type { CivicBriefSummary } from "@/lib/server/civic-brief";

type CivicBriefPanelProps = {
  brief: CivicBriefSummary;
  cadenceLinks: Array<{
    label: string;
    href: string;
    active: boolean;
  }>;
};

function BriefInlineLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="font-semibold text-civic-700 underline decoration-civic-200 underline-offset-4 hover:text-civic-900">
      {children}
    </Link>
  );
}

export function CivicBriefPanel({ brief, cadenceLinks }: CivicBriefPanelProps) {
  return (
    <section className="rounded-[1.9rem] border border-civic-100 bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.65),_rgba(255,255,255,0.97)_45%,_rgba(240,249,255,0.98))] p-6 shadow-card backdrop-blur sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-civic-700">Your Civic Brief</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{brief.headline}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{brief.intro}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {cadenceLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              scroll={false}
              className={
                link.active
                  ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              }
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {brief.personalization.topIssues.length ? (
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            Top issues: {brief.personalization.topIssues.join(" · ")}
          </span>
        ) : null}
        {brief.personalization.followedPeopleCount ? (
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            Following {brief.personalization.followedPeopleCount} civic voice{brief.personalization.followedPeopleCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {brief.personalization.followedCommunityNames.map((communityName) => (
          <span key={communityName} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            Watching {communityName}
          </span>
        ))}
      </div>

      {brief.stakesLine ? (
        <div className="mt-4 rounded-[1.35rem] border border-white/70 bg-slate-950 px-4 py-3 text-sm font-medium text-white">
          {brief.stakesLine}
        </div>
      ) : null}

      <div className="mt-6 rounded-[1.5rem] border border-white/70 bg-white/85 p-5">
        <p className="text-sm font-semibold text-ink">What moved in your civic world</p>
        {brief.keyDevelopments.length ? (
          <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
            {brief.keyDevelopments.map((item) => (
              <li key={item.id}>
                <span className="font-semibold text-ink">{item.label}:</span> {item.detail}{" "}
                <span className="text-slate-500">({item.reason})</span>{" "}
                <BriefInlineLink href={item.href}>
                  {item.label === "Petition"
                    ? "View petition activity"
                    : item.label === "Debate"
                      ? "View debate"
                      : item.label === "Event"
                        ? "See event details"
                        : item.label === "News"
                          ? "Open story"
                          : item.label === "Response"
                            ? "See public response"
                            : "See supporting posts"}
                </BriefInlineLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            No standout developments landed in this cadence yet, but the feed below still has the latest public civic activity.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-[1.5rem] border border-white/70 bg-white/80 p-5">
        <p className="text-sm font-semibold text-ink">Who responded</p>
        {brief.responses.length ? (
          <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
            {brief.responses.map((item) => (
              <li key={item.id}>
                <span className="font-semibold text-ink">{item.title}.</span> {item.detail}{" "}
                <span className="text-slate-500">({item.reason})</span>{" "}
                <BriefInlineLink href={item.href}>Open response</BriefInlineLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            No standout public responses rose above the noise in this cadence.
          </p>
        )}
      </div>

      <details className="group mt-4 rounded-[1.5rem] border border-white/70 bg-white/80 p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Expand this brief</p>
            <p className="mt-1 text-sm text-slate-600">See what is gaining momentum and the one next step most worth your attention.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 transition group-open:bg-civic-50 group-open:text-civic-700">
            More detail
          </span>
        </summary>

        <div className="mt-4 space-y-5">
          <div>
            <p className="text-sm font-semibold text-ink">What is gaining momentum</p>
            {brief.momentum.length ? (
              <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
                {brief.momentum.map((item) => (
                  <li key={item.id}>
                    <span className="font-semibold text-ink">{item.title}.</span> {item.detail}{" "}
                    <span className="text-slate-500">({item.reason})</span>{" "}
                    <BriefInlineLink href={item.href}>
                      {item.label === "Petition"
                        ? "Open petition"
                        : item.label === "Debate"
                          ? "Open debate"
                          : item.label === "Event"
                            ? "Open event"
                            : item.label === "News"
                              ? "Open story"
                              : "Open item"}
                    </BriefInlineLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Momentum is lighter right now, so the main feed remains the best place to scan broadly.
              </p>
            )}
          </div>

          <div className="rounded-[1.25rem] bg-slate-950 p-4 text-white">
            <p className="text-sm font-semibold">What may need your attention</p>
            {brief.attention ? (
              <p className="mt-3 text-sm leading-6 text-slate-200">
                <span className="font-semibold text-white">{brief.attention.title}.</span> {brief.attention.detail}{" "}
                <span className="text-civic-200">({brief.attention.reason})</span>{" "}
                <Link href={brief.attention.href} className="font-semibold text-white underline decoration-civic-200 underline-offset-4 hover:text-civic-100">
                  Open now
                </Link>
              </p>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Nothing needs immediate attention right now. Use the feed below to keep scanning your civic world.
              </p>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}
