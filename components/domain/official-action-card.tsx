import Link from "next/link";

import { reactToOfficialAction } from "@/lib/officials/action-reactions";
import type { OfficialActionSummary } from "@/types/domain";

type OfficialActionCardProps = {
  action: OfficialActionSummary;
  returnPath: string;
  compact?: boolean;
  viewerAlignment?: {
    status: "aligned" | "against" | "mixed" | "unknown";
    label: string;
    detail?: string | null;
  } | null;
};

function formatActionType(value: OfficialActionSummary["actionType"]) {
  switch (value) {
    case "voteCast":
      return "Vote cast";
    case "billSponsored":
      return "Bill sponsored";
    case "billCoSponsored":
      return "Bill co-sponsored";
    case "executiveAction":
      return "Executive action";
    case "publicStatement":
      return "Public statement";
    case "meetingHeld":
      return "Meeting held";
    case "budgetProposal":
      return "Budget proposal";
    case "policyAnnouncement":
      return "Policy announcement";
    case "committeeAction":
      return "Committee action";
    default:
      return value;
  }
}

function formatSourceType(value: OfficialActionSummary["sourceType"]) {
  return value === "official" ? "Official source" : value === "media" ? "Media source" : "Citizen-submitted";
}

function formatVerificationStatus(value: OfficialActionSummary["verificationStatus"]) {
  return value === "verified" ? "Verified" : value === "sourced" ? "Sourced" : "Unverified";
}

function verificationClassName(value: OfficialActionSummary["verificationStatus"]) {
  if (value === "verified") {
    return "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700";
  }

  if (value === "sourced") {
    return "rounded-full bg-civic-100 px-3 py-1 text-xs font-semibold text-civic-700";
  }

  return "rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700";
}

function formatAccountabilityAlignment(value: OfficialActionSummary["accountabilityAlignment"]) {
  if (value === "aligned") return "Supports Public Reliability";
  if (value === "against") return "Against stated commitments";
  if (value === "mixed") return "Mixed accountability signal";
  return null;
}

function accountabilityClassName(value: OfficialActionSummary["accountabilityAlignment"]) {
  if (value === "aligned") {
    return "rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700";
  }

  if (value === "against") {
    return "rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700";
  }

  if (value === "mixed") {
    return "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700";
  }

  return null;
}

function formatPartyAlignment(value: OfficialActionSummary["partyAlignment"]) {
  if (value === "aligned") return "With party";
  if (value === "against") return "Against party";
  if (value === "mixed") return "Party context mixed";
  return null;
}

function partyAlignmentClassName(value: OfficialActionSummary["partyAlignment"]) {
  if (value === "aligned") {
    return "rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700";
  }

  if (value === "against") {
    return "rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700";
  }

  if (value === "mixed") {
    return "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700";
  }

  return null;
}

export function OfficialActionCard({ action, returnPath, compact = false, viewerAlignment = null }: OfficialActionCardProps) {
  const accountabilityLabel = formatAccountabilityAlignment(action.accountabilityAlignment);
  const accountabilityClass = accountabilityClassName(action.accountabilityAlignment);
  const partyLabel = formatPartyAlignment(action.partyAlignment);
  const partyClass = partyAlignmentClassName(action.partyAlignment);
  const visibleTags = compact ? action.issueTags.slice(0, 3) : action.issueTags;
  const remainingTagCount = Math.max(0, action.issueTags.length - visibleTags.length);
  const viewerAlignmentClass =
    viewerAlignment?.status === "aligned"
      ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
      : viewerAlignment?.status === "against"
        ? "rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"
        : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700";

  return (
    <article
      className={
        compact
          ? "rounded-[1.35rem] border border-slate-200 bg-slate-50/90 p-3.5 shadow-[0_10px_30px_-28px_rgba(15,23,42,0.5)]"
          : "rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{formatActionType(action.actionType)}</p>
          <h3 className={compact ? "mt-1.5 text-base font-semibold leading-snug text-ink" : "mt-2 text-xl font-semibold text-ink"}>{action.title}</h3>
          <div className={compact ? "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1" : "mt-2"}>
            <p className="text-sm font-medium text-slate-600">{action.officialName}</p>
            {compact ? (
              <p className="text-sm text-slate-500">
                {new Date(action.actionDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            ) : null}
          </div>
          {!compact ? (
            <p className="mt-2 text-sm text-slate-500">
              {new Date(action.actionDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          ) : null}
          <p className={compact ? "mt-2.5 text-sm leading-6 text-slate-600" : "mt-4 text-sm leading-7 text-slate-600"}>
            {action.summary}
          </p>
        </div>
        <span className={verificationClassName(action.verificationStatus)}>{formatVerificationStatus(action.verificationStatus)}</span>
      </div>

      {accountabilityLabel && accountabilityClass ? (
        <div className={compact ? "mt-2.5 flex flex-wrap items-center gap-2" : "mt-4 flex flex-wrap items-center gap-2"}>
          <span className={accountabilityClass}>{accountabilityLabel}</span>
          {action.accountabilityReason ? (
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{action.accountabilityReason}</p>
          ) : null}
        </div>
      ) : null}

      {partyLabel && partyClass ? (
        <div className={compact ? "mt-2 flex flex-wrap items-center gap-2" : "mt-3 flex flex-wrap items-center gap-2"}>
          <span className={partyClass}>{partyLabel}</span>
          {action.partyAlignmentReason ? (
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{action.partyAlignmentReason}</p>
          ) : null}
        </div>
      ) : null}

      {viewerAlignment ? (
        <div className={compact ? "mt-2 flex flex-wrap items-center gap-2" : "mt-3 flex flex-wrap items-center gap-2"}>
          <span className={viewerAlignmentClass}>{viewerAlignment.label}</span>
          {viewerAlignment.detail ? <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{viewerAlignment.detail}</p> : null}
        </div>
      ) : null}

      <div className={compact ? "mt-2.5 flex flex-wrap gap-2" : "mt-4 flex flex-wrap gap-2"}>
        {visibleTags.map((tag) => (
          <Link
            key={tag}
            href={`/voting?search=${encodeURIComponent(tag)}`}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            {tag}
          </Link>
        ))}
        {remainingTagCount ? <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">+{remainingTagCount} more</span> : null}
      </div>

      <div className={compact ? "mt-2.5 flex flex-wrap items-center gap-3 text-xs font-semibold" : "mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold"}>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{formatSourceType(action.sourceType)}</span>
        {action.sourceLink ? (
          <Link href={action.sourceLink} className="text-civic-700 transition hover:text-civic-900">
            View source
          </Link>
        ) : null}
      </div>

      <div className={compact ? "mt-3.5 flex flex-wrap gap-2.5" : "mt-5 flex flex-wrap gap-3"}>
        <form action={reactToOfficialAction}>
          <input type="hidden" name="actionId" value={action.id} />
          <input type="hidden" name="reaction" value="support" />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button
            type="submit"
            className={
              action.viewerReaction === "support"
                ? compact
                  ? "rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                : compact
                  ? "rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300"
                  : "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300"
            }
          >
            Support · {action.supportCount}
          </button>
        </form>
        <form action={reactToOfficialAction}>
          <input type="hidden" name="actionId" value={action.id} />
          <input type="hidden" name="reaction" value="oppose" />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button
            type="submit"
            className={
              action.viewerReaction === "oppose"
                ? compact
                  ? "rounded-full bg-slate-950 px-3.5 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                : compact
                  ? "rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
                  : "rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            }
          >
            Oppose · {action.opposeCount}
          </button>
        </form>
      </div>
    </article>
  );
}
