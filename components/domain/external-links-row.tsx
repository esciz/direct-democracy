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
    classes: "bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-900 hover:text-white",
  },
  linkedin: {
    label: "LinkedIn",
    shortLabel: "in",
    classes: "bg-sky-50 text-sky-700 ring-sky-200 hover:bg-sky-600 hover:text-white",
  },
  instagram: {
    label: "Instagram",
    shortLabel: "IG",
    classes: "bg-pink-50 text-pink-700 ring-pink-200 hover:bg-pink-600 hover:text-white",
  },
  x: {
    label: "X",
    shortLabel: "X",
    classes: "bg-slate-100 text-slate-700 ring-slate-200 hover:bg-black hover:text-white",
  },
  facebook: {
    label: "Facebook",
    shortLabel: "f",
    classes: "bg-blue-50 text-blue-700 ring-blue-200 hover:bg-blue-700 hover:text-white",
  },
  youtube: {
    label: "YouTube",
    shortLabel: "▶",
    classes: "bg-red-50 text-red-700 ring-red-200 hover:bg-red-600 hover:text-white",
  },
  tiktok: {
    label: "TikTok",
    shortLabel: "♪",
    classes: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200 hover:bg-fuchsia-700 hover:text-white",
  },
  newsletter: {
    label: "Newsletter / Substack",
    shortLabel: "✉",
    classes: "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-600 hover:text-white",
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
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
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
