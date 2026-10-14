import Link from "next/link";

import type { PublicIssuePositionSummary } from "@/types/domain";

type IssuePositionsSectionProps = {
  positions: PublicIssuePositionSummary[];
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  variant?: "dark" | "light";
  correctionHref?: string | null;
};

const stanceLabels: Record<PublicIssuePositionSummary["stance"], string> = {
  SUPPORTS: "Supports",
  OPPOSES: "Opposes",
  MIXED: "Mixed",
  UNKNOWN: "Unknown",
  CHANGED: "Changed",
};

const derivationLabels: Record<PublicIssuePositionSummary["derivation"], string> = {
  OFFICIAL: "Direct source",
  INFERRED: "Inferred from source",
  UNKNOWN: "Source status unknown",
};

function confidenceLabel(value: number) {
  return `${Math.round(value * 100)}% confidence`;
}

function panelClasses(variant: "dark" | "light") {
  return variant === "dark"
    ? {
        shell: "dd-panel-muted rounded-[1.75rem] p-6 sm:p-8",
        muted: "text-slate-400",
        title: "text-slate-50",
        card: "rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4",
        chip: "border border-white/10 bg-white/[0.05] text-slate-300",
        primaryLink: "text-cyan-200 hover:text-cyan-100",
        empty: "rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400",
      }
    : {
        shell: "rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur",
        muted: "text-slate-600",
        title: "text-ink",
        card: "rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm",
        chip: "border border-slate-200 bg-slate-50 text-slate-700",
        primaryLink: "text-civic-700 hover:text-civic-900",
        empty: "rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600",
      };
}

export function IssuePositionsSection({
  positions,
  title = "Issue Positions",
  description = "Reviewed candidate and official positions tied to existing issue pages and source-attributed evidence.",
  emptyTitle = "Issue positions pending",
  emptyDescription = "No approved, sourced issue positions are available yet.",
  variant = "dark",
  correctionHref = null,
}: IssuePositionsSectionProps) {
  const classes = panelClasses(variant);

  return (
    <section className={classes.shell}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${variant === "dark" ? "text-cyan-200" : "text-civic-700"}`}>
            Sourced issue positions
          </p>
          <h2 className={`mt-2 text-2xl font-semibold tracking-tight ${classes.title}`}>{title}</h2>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${classes.muted}`}>{description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes.chip}`}>
          {positions.length} approved position{positions.length === 1 ? "" : "s"}
        </span>
      </div>

      {positions.length ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {positions.map((position) => (
            <article key={position.id} className={classes.card}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  {stanceLabels[position.stance]}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes.chip}`}>{derivationLabels[position.derivation]}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes.chip}`}>{confidenceLabel(position.confidenceScore)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <Link href={`/issues/${position.issueSlug}`} className={`text-lg font-semibold ${classes.primaryLink}`}>
                  {position.issueText}
                </Link>
                <span className={`text-sm ${classes.muted}`}>for</span>
                <Link href={position.subject.href} className={`text-sm font-semibold ${classes.primaryLink}`}>
                  {position.subject.name}
                </Link>
              </div>
              <p className={`mt-1 text-sm ${classes.muted}`}>
                {[position.subject.officeTitle, position.subject.jurisdictionName, position.subject.partyText].filter(Boolean).join(" · ")}
              </p>
              <p className={`mt-3 text-sm leading-6 ${variant === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                {position.summary ?? "No public summary is approved yet; source attribution is shown while review continues."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className={`rounded-full px-3 py-1 ${classes.chip}`}>Review: {position.reviewStatus}</span>
                <span className={`rounded-full px-3 py-1 ${classes.chip}`}>Verification: {position.verificationStatus}</span>
                <span className={`rounded-full px-3 py-1 ${classes.chip}`}>Updated {new Date(position.lastObservedAt).toLocaleDateString()}</span>
                {position.changeCount ? <span className={`rounded-full px-3 py-1 ${classes.chip}`}>{position.changeCount} change record{position.changeCount === 1 ? "" : "s"}</span> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
                {position.sourceUrl ? (
                  <Link href={position.sourceUrl} className={classes.primaryLink}>
                    Source: {position.sourceName ?? position.evidenceSourceName ?? "View evidence"}
                  </Link>
                ) : (
                  <span className={classes.muted}>Source link pending review</span>
                )}
                <Link href={`/voting?search=${encodeURIComponent(position.issueText)}`} className={classes.primaryLink}>
                  Ask community sentiment
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={`mt-5 ${classes.empty}`}>
          <p className={variant === "dark" ? "font-semibold text-slate-100" : "font-semibold text-ink"}>{emptyTitle}</p>
          <p className="mt-2">{emptyDescription}</p>
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/take-action" className={classes.card}>
          <p className={variant === "dark" ? "text-sm font-semibold text-slate-100" : "text-sm font-semibold text-ink"}>Contact representative</p>
          <p className={`mt-2 text-xs leading-5 ${classes.muted}`}>Use existing action flows for this issue.</p>
        </Link>
        <Link href="/candidates" className={classes.card}>
          <p className={variant === "dark" ? "text-sm font-semibold text-slate-100" : "text-sm font-semibold text-ink"}>Compare candidates</p>
          <p className={`mt-2 text-xs leading-5 ${classes.muted}`}>Open candidate records tied to imported races.</p>
        </Link>
        <Link href="/voting" className={classes.card}>
          <p className={variant === "dark" ? "text-sm font-semibold text-slate-100" : "text-sm font-semibold text-ink"}>Ask community sentiment</p>
          <p className={`mt-2 text-xs leading-5 ${classes.muted}`}>Reviewed positions can become one-at-a-time voting questions.</p>
        </Link>
        {correctionHref ? (
          <Link href={correctionHref} className={classes.card}>
            <p className={variant === "dark" ? "text-sm font-semibold text-slate-100" : "text-sm font-semibold text-ink"}>Submit correction / source</p>
            <p className={`mt-2 text-xs leading-5 ${classes.muted}`}>Use the existing claim and review path.</p>
          </Link>
        ) : (
          <div className={classes.card}>
            <p className={variant === "dark" ? "text-sm font-semibold text-slate-100" : "text-sm font-semibold text-ink"}>Submit correction / source</p>
            <p className={`mt-2 text-xs leading-5 ${classes.muted}`}>Correction intake appears where a profile claim path exists.</p>
          </div>
        )}
      </div>
    </section>
  );
}
