"use client";

import { useEffect, useMemo, useState } from "react";

type CivicAvatarEntityType =
  | "citizen"
  | "trustedCitizen"
  | "candidate"
  | "official"
  | "organization"
  | "media"
  | "community"
  | "agency"
  | "case"
  | "publicAccountability"
  | "petition"
  | "issue";

type CivicAvatarProps = {
  name?: string | null;
  imageUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  entityType?: CivicAvatarEntityType;
  verified?: boolean;
  active?: boolean;
  className?: string;
  title?: string;
};

const sizeClasses = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
} as const;

const typeThemes: Record<CivicAvatarEntityType, { bg: string; ring: string; glyph: string }> = {
  citizen: { bg: "from-slate-500 via-slate-600 to-slate-900", ring: "ring-white/10", glyph: "CI" },
  trustedCitizen: { bg: "from-cyan-500 via-sky-500 to-slate-950", ring: "ring-cyan-300/35", glyph: "TC" },
  candidate: { bg: "from-indigo-500 via-violet-500 to-slate-950", ring: "ring-indigo-300/35", glyph: "CA" },
  official: { bg: "from-emerald-500 via-teal-500 to-slate-950", ring: "ring-emerald-300/35", glyph: "OF" },
  organization: { bg: "from-amber-500 via-orange-500 to-slate-950", ring: "ring-amber-300/35", glyph: "OR" },
  media: { bg: "from-fuchsia-500 via-rose-500 to-slate-950", ring: "ring-fuchsia-300/35", glyph: "ME" },
  community: { bg: "from-sky-500 via-cyan-500 to-slate-950", ring: "ring-cyan-300/35", glyph: "CO" },
  agency: { bg: "from-teal-500 via-cyan-500 to-slate-950", ring: "ring-teal-300/35", glyph: "AG" },
  case: { bg: "from-rose-500 via-orange-500 to-slate-950", ring: "ring-rose-300/35", glyph: "CS" },
  publicAccountability: { bg: "from-orange-500 via-amber-500 to-slate-950", ring: "ring-orange-300/35", glyph: "PA" },
  petition: { bg: "from-emerald-500 via-lime-500 to-slate-950", ring: "ring-emerald-300/35", glyph: "PE" },
  issue: { bg: "from-cyan-500 via-blue-500 to-slate-950", ring: "ring-cyan-300/35", glyph: "IS" },
};

function getInitials(name: string | null | undefined, glyph: string) {
  const safeName = name?.trim();
  if (!safeName) {
    return glyph;
  }

  const parts = safeName.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return glyph;
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function CivicAvatar({
  name,
  imageUrl,
  size = "sm",
  entityType = "citizen",
  verified = false,
  active = false,
  className = "",
  title,
}: CivicAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const safeImageUrl = typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null;
  const theme = typeThemes[entityType];
  const initials = useMemo(() => getInitials(name, theme.glyph), [name, theme.glyph]);
  const ringClass = verified || active ? theme.ring : "ring-white/10";

  useEffect(() => {
    setImageFailed(false);
  }, [safeImageUrl]);

  if (safeImageUrl && !imageFailed) {
    return (
      <div
        title={title ?? name ?? undefined}
        className={`relative shrink-0 overflow-hidden rounded-full border border-white/12 bg-slate-950 shadow-[0_12px_28px_-18px_rgba(15,23,42,0.9)] ring-1 ${ringClass} ${sizeClasses[size]} ${className}`}
      >
        <img
          src={safeImageUrl}
          alt={name?.trim() || `${entityType} avatar`}
          className="h-full w-full object-cover"
          onError={() => {
            setImageFailed(true);
          }}
        />
      </div>
    );
  }

  return (
    <div
      title={title ?? name ?? undefined}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/12 bg-gradient-to-br ${theme.bg} font-semibold text-white shadow-[0_12px_28px_-18px_rgba(15,23,42,0.9)] ring-1 ${ringClass} ${sizeClasses[size]} ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_42%)]" />
      <span className="relative drop-shadow-[0_6px_14px_rgba(15,23,42,0.32)]">{initials}</span>
    </div>
  );
}
