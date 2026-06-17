"use client";

import { useState, useTransition } from "react";

import { toggleFavoriteAction } from "@/lib/favorites/actions";
import type { FavoriteTargetType } from "@/lib/favorites/types";

type FavoriteToggleButtonProps = {
  targetType: FavoriteTargetType;
  targetId: string;
  initialFavorited: boolean;
  className?: string;
  visibleLabel?: string;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4.5 w-4.5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20.5 4.9 14.1a4.7 4.7 0 0 1 6.6-6.7L12 8l.5-.6a4.7 4.7 0 1 1 6.6 6.7L12 20.5Z" />
    </svg>
  );
}

export function FavoriteToggleButton({
  targetType,
  targetId,
  initialFavorited,
  className,
  visibleLabel,
}: FavoriteToggleButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const label = isPending
    ? "Saving favorite status"
    : favorited
      ? "Remove from favorites"
      : "Add to favorites";

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        aria-pressed={favorited}
        aria-label={label}
        title={label}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setError(null);

          startTransition(async () => {
            const result = await toggleFavoriteAction({ targetType, targetId });

            if (!result.ok) {
              setError(result.message ?? "Favorite status could not be updated.");
              return;
            }

            setFavorited(result.favorited);
          });
        }}
        className={
          className ??
          (favorited
            ? "inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
            : "inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-civic-500 hover:text-civic-700")
        }
      >
        <HeartIcon filled={favorited} />
        {visibleLabel ? <span className="ml-2">{visibleLabel}</span> : null}
        <span className="sr-only">{label}</span>
      </button>
      {error ? <span className="text-xs text-orange-700">{error}</span> : null}
    </div>
  );
}
