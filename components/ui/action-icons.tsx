import type { ReactNode } from "react";

type IconProps = {
  className?: string;
};

function iconClass(className?: string) {
  return className ?? "h-4 w-4";
}

export function ThumbsUpIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10v10" />
      <path d="M12 10 14.5 4c.3-.8 1.3-1.2 2-.7.4.3.6.8.5 1.3L16.2 10H20a2 2 0 0 1 2 2l-1.2 6a2 2 0 0 1-2 1.6H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h5Z" />
    </svg>
  );
}

export function ThumbsDownIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4v10" />
      <path d="m12 14 2.5 6c.3.8 1.3 1.2 2 .7.4-.3.6-.8.5-1.3L16.2 14H20a2 2 0 0 0 2-2l-1.2-6A2 2 0 0 0 18.8 4H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h5Z" />
    </svg>
  );
}

export function FlagIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4" />
      <path d="M5 5h10l-1.4 3L15 11H5" />
    </svg>
  );
}

export function FactCheckIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="M15 15l4.5 4.5" />
      <path d="M8.5 9h4" />
      <path d="M8.5 12h2.6" />
    </svg>
  );
}

export function ScaleIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v14" />
      <path d="M8 7h8" />
      <path d="M5 7l-2.5 4a3 3 0 0 0 5 0L5 7Z" />
      <path d="M19 7l-2.5 4a3 3 0 0 0 5 0L19 7Z" />
      <path d="M8 20h8" />
    </svg>
  );
}

export function MegaphoneIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 13v-2l10-4v10L4 13Z" />
      <path d="M14 9.5c2.5 0 4.5-1 6-3v11c-1.5-2-3.5-3-6-3" />
      <path d="M7.5 13.5 9 20h2l-1.2-5.3" />
    </svg>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 11 7.4-4.3" />
      <path d="m8.2 13 7.4 4.3" />
    </svg>
  );
}

export function CommentBubbleIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 17.5 3 20V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H6Z" />
      <path d="M8 9h8" />
      <path d="M8 12h5" />
    </svg>
  );
}

export function CommentSpeakIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M3.5 18a4.5 4.5 0 0 1 9 0" />
      <path d="M16 9c1.4.4 2.5 1.5 2.9 2.9" />
      <path d="M16.5 5.5A4.5 4.5 0 0 1 20.5 9.5" />
    </svg>
  );
}

export function ActionLabel({
  icon,
  children,
  iconClassName,
}: {
  icon: ReactNode;
  children: ReactNode;
  iconClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={iconClassName ?? "shrink-0"}>{icon}</span>
      <span>{children}</span>
    </span>
  );
}

export function BallotBoxIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 10h14v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9Z" />
      <path d="M9 10V5h6v5" />
      <path d="M12 4v8" />
      <path d="m9.5 8 2.5 2 2.5-2" />
    </svg>
  );
}

export function IssueSparkIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 9.6 8.2 3 10.5l6.6 2.3L12 19l2.4-6.2 6.6-2.3-6.6-2.3L12 2Z" />
      <path d="M5 3v2" />
      <path d="M19 19v2" />
      <path d="M3 5h2" />
      <path d="M19 19h2" />
    </svg>
  );
}

export function DebateSparkIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h8v6H7.5L4 15V6Z" />
      <path d="M20 9h-8v6h4.5L20 18V9Z" />
      <path d="M8 8.5h.01" />
      <path d="M16 11.5h.01" />
    </svg>
  );
}

export function PollChartIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V9" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20v-11" />
    </svg>
  );
}

export function PetitionRibbonIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h8l3 3v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M15 3v4h4" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}

export function CaseGavelIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="m14 6 4 4" />
      <path d="m5 15 8-8 6 6-8 8H5v-6Z" />
      <path d="M3 21h18" />
    </svg>
  );
}

export function EventArcIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M4 10h16" />
      <path d="M9 14h6" />
    </svg>
  );
}

export function MessageStreamIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v10a2 2 0 0 1-2 2H9l-5 3V5Z" />
      <path d="M8 9h8" />
      <path d="M8 12h5" />
    </svg>
  );
}

export function TrustShieldIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3Z" />
      <path d="m9.5 12 1.7 1.7L15 10" />
    </svg>
  );
}

export function EndorsementSealIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="5" />
      <path d="m9.5 14 1.2 6L12 18.8 13.3 20l1.2-6" />
      <path d="m10.5 9 1 1 2-2" />
    </svg>
  );
}

export function PulseBoltIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 6 13h5l-1 9 8-12h-5l0-8Z" />
    </svg>
  );
}

export function getEyebrowIcon(label: string) {
  const normalized = label.trim().toLowerCase();

  if (normalized.includes("feed")) return PulseBoltIcon;
  if (normalized.includes("issue")) return IssueSparkIcon;
  if (normalized.includes("debate")) return DebateSparkIcon;
  if (normalized.includes("poll")) return PollChartIcon;
  if (normalized.includes("petition")) return PetitionRibbonIcon;
  if (normalized.includes("case")) return CaseGavelIcon;
  if (normalized.includes("event")) return EventArcIcon;
  if (normalized.includes("message")) return MessageStreamIcon;
  if (normalized.includes("truth") || normalized.includes("reputation") || normalized.includes("credibility")) return TrustShieldIcon;
  if (normalized.includes("election") || normalized.includes("vote")) return BallotBoxIcon;
  if (normalized.includes("official")) return TrustShieldIcon;
  if (normalized.includes("candidate")) return EndorsementSealIcon;
  if (normalized.includes("explore")) return IssueSparkIcon;
  if (normalized.includes("community")) return PulseBoltIcon;

  return PulseBoltIcon;
}
