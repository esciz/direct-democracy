import Link from "next/link";
import type { ReactNode } from "react";

type RevealIconChipProps = {
  icon: string;
  label: string;
  href?: string;
  tone?: "slate" | "civic" | "orange";
  leading?: ReactNode;
};

function getToneClasses(tone: NonNullable<RevealIconChipProps["tone"]>) {
  switch (tone) {
    case "civic":
      return "bg-civic-50 text-civic-700 ring-civic-200 hover:bg-civic-100";
    case "orange":
      return "bg-orange-50 text-orange-700 ring-orange-200 hover:bg-orange-100";
    default:
      return "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50";
  }
}

function RevealIconChipInner({ icon, label, tone = "slate", leading }: RevealIconChipProps) {
  return (
    <>
      {leading}
      <span aria-hidden="true" className="text-sm leading-none">
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-[12rem] group-hover:opacity-100 group-focus-visible:max-w-[12rem] group-focus-visible:opacity-100 group-active:max-w-[12rem] group-active:opacity-100">
        {label}
      </span>
    </>
  );
}

export function RevealIconChip({ icon, label, href, tone = "slate", leading }: RevealIconChipProps) {
  const className = `group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${getToneClasses(
    tone,
  )}`;

  if (href) {
    return (
      <Link href={href} title={label} aria-label={label} className={className}>
        <RevealIconChipInner icon={icon} label={label} tone={tone} leading={leading} />
      </Link>
    );
  }

  return (
    <span title={label} aria-label={label} tabIndex={0} className={className}>
      <RevealIconChipInner icon={icon} label={label} tone={tone} leading={leading} />
    </span>
  );
}
