import type { ExternalLinkPlatform, ExternalLinkSummary } from "@/types/domain";

const PLATFORM_META: Record<
  ExternalLinkPlatform,
  {
    label: string;
    shortLabel: string;
    classes: string;
  }
> = {
  website: {
    label: "Website",
    shortLabel: "↗",
    classes: "border-white/12 bg-white/[0.05] text-slate-100 ring-white/10 hover:border-cyan-300/25 hover:bg-white/[0.08] hover:text-white",
  },
  linkedin: {
    label: "LinkedIn",
    shortLabel: "in",
    classes: "border-sky-400/18 bg-sky-500/10 text-sky-200 ring-sky-400/10 hover:bg-sky-500/18 hover:text-white",
  },
  instagram: {
    label: "Instagram",
    shortLabel: "IG",
    classes: "border-pink-400/18 bg-pink-500/10 text-pink-200 ring-pink-400/10 hover:bg-pink-500/18 hover:text-white",
  },
  x: {
    label: "X",
    shortLabel: "X",
    classes: "border-white/12 bg-white/[0.05] text-slate-100 ring-white/10 hover:border-white/20 hover:bg-white/[0.08] hover:text-white",
  },
  facebook: {
    label: "Facebook",
    shortLabel: "f",
    classes: "border-blue-400/18 bg-blue-500/10 text-blue-200 ring-blue-400/10 hover:bg-blue-500/18 hover:text-white",
  },
  youtube: {
    label: "YouTube",
    shortLabel: "▶",
    classes: "border-red-400/18 bg-red-500/10 text-red-200 ring-red-400/10 hover:bg-red-500/18 hover:text-white",
  },
  tiktok: {
    label: "TikTok",
    shortLabel: "♪",
    classes: "border-fuchsia-400/18 bg-fuchsia-500/10 text-fuchsia-200 ring-fuchsia-400/10 hover:bg-fuchsia-500/18 hover:text-white",
  },
  newsletter: {
    label: "Newsletter / Substack",
    shortLabel: "✉",
    classes: "border-amber-400/18 bg-amber-500/10 text-amber-200 ring-amber-400/10 hover:bg-amber-500/18 hover:text-white",
  },
};

type ExternalLinksRowProps = {
  links: ExternalLinkSummary[];
  title?: string;
  description?: string;
  compact?: boolean;
};

export function ExternalLinksRow({
  links,
  title = "External Links",
  description,
  compact = false,
}: ExternalLinksRowProps) {
  if (!Array.isArray(links) || links.length === 0) {
    return null;
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</p>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => {
          const meta = PLATFORM_META[link.platform];

          return (
            <a
              key={`${link.platform}:${link.url}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              aria-label={meta.label}
              title={meta.label}
              className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-semibold ring-1 transition ${meta.classes}`}
            >
              <span aria-hidden="true">{meta.shortLabel}</span>
              <span className="sr-only">{meta.label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
