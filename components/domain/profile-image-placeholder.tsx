"use client";

import { useEffect, useMemo, useState } from "react";

type ProfileImagePlaceholderProps = {
  name: string;
  size?: "sm" | "lg";
  imageUrl?: string | null;
};

export function ProfileImagePlaceholder({ name, size = "sm", imageUrl }: ProfileImagePlaceholderProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const safeName = name?.trim() || "Demo User";
  const safeImageUrl = typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null;
  const initials = safeName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const sizeClass = size === "lg" ? "h-28 w-28 text-3xl" : "h-14 w-14 text-lg";
  const palette = [
    "from-civic-500 via-sky-500 to-slate-950",
    "from-emerald-500 via-teal-500 to-slate-950",
    "from-orange-400 via-amber-500 to-slate-900",
    "from-rose-400 via-fuchsia-500 to-slate-950",
  ];
  const paletteIndex = safeName.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;

  useEffect(() => {
    setImageFailed(false);
  }, [safeImageUrl]);

  const shouldShowImage = useMemo(() => Boolean(safeImageUrl && !imageFailed), [imageFailed, safeImageUrl]);

  if (shouldShowImage && safeImageUrl) {
    return (
      <div className={`relative overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/70 shadow-card ${sizeClass}`}>
        <img
          src={safeImageUrl}
          alt={safeName}
          className="h-full w-full object-cover"
          onError={(event) => {
            console.error("Profile image failed to load:", safeImageUrl, event);
            setImageFailed(true);
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.06))] ring-1 ring-black/5" />
      </div>
    );
  }

  return (
    <div
      className={`relative flex ${sizeClass} items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/30 bg-gradient-to-br ${palette[paletteIndex]} font-semibold text-white shadow-card`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_40%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 rounded-t-[60%] bg-white/10" />
      <div className="absolute inset-x-5 bottom-0 h-3/5 rounded-t-[999px] bg-white/15" />
      <div className="absolute left-1/2 top-[24%] h-10 w-10 -translate-x-1/2 rounded-full bg-white/16 blur-[1px]" />
      <div className="absolute right-2 top-2 h-4 w-4 rounded-full border border-white/45 bg-white/20" />
      <span className="relative drop-shadow-[0_6px_16px_rgba(15,23,42,0.28)]">{initials}</span>
    </div>
  );
}
