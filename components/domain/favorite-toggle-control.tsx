import { FavoriteToggleButton } from "@/components/domain/favorite-toggle-button";
import { isGuestUser } from "@/lib/auth/session";
import type { FavoriteTargetType } from "@/lib/favorites/types";
import { getCurrentSessionUser } from "@/lib/server/auth-session";
import { isFavoriteForCurrentViewer } from "@/lib/server/favorites";

type FavoriteToggleControlProps = {
  targetType: FavoriteTargetType;
  targetId: string;
  className?: string;
  visibleLabel?: string;
};

function GuestHeartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4.5 w-4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20.5 4.9 14.1a4.7 4.7 0 0 1 6.6-6.7L12 8l.5-.6a4.7 4.7 0 1 1 6.6 6.7L12 20.5Z" />
    </svg>
  );
}

function GuestFollowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4.5 w-4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 4.5h11v15L12 16l-5.5 3.5v-15Z" />
    </svg>
  );
}

export async function FavoriteToggleControl({
  targetType,
  targetId,
  className,
  visibleLabel,
}: FavoriteToggleControlProps) {
  const currentUser = await getCurrentSessionUser();
  const isIssue = targetType === "issue";
  const guestLabel = isIssue ? "Sign in to follow issue" : "Sign in to save item";

  if (!currentUser || isGuestUser(currentUser)) {
    return (
      <a
        href="/get-started?step=account"
        aria-label={guestLabel}
        title={guestLabel}
        className={
          className ??
          "inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-civic-500 hover:text-civic-700"
        }
      >
        {isIssue ? <GuestFollowIcon /> : <GuestHeartIcon />}
        {visibleLabel ? <span className="ml-2">{visibleLabel}</span> : null}
        <span className="sr-only">{guestLabel}</span>
      </a>
    );
  }

  const initialFavorited = await isFavoriteForCurrentViewer(targetType, targetId);

  return (
    <FavoriteToggleButton
      targetType={targetType}
      targetId={targetId}
      initialFavorited={initialFavorited}
      className={className}
      visibleLabel={visibleLabel}
    />
  );
}
