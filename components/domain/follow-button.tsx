import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { followUser, unfollowUser } from "@/lib/social/actions";

type FollowButtonProps = {
  targetUserId: string;
  returnPath: string;
  isFollowing: boolean;
  className?: string;
};

export function FollowButton({ targetUserId, returnPath, isFollowing, className }: FollowButtonProps) {
  const action = isFollowing ? unfollowUser : followUser;
  const defaultClassName = isFollowing
    ? "rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
    : "rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300";

  return (
    <form action={action}>
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <FormSubmitButton
        idleLabel={isFollowing ? "Unfollow" : "Follow"}
        pendingLabel={isFollowing ? "Updating..." : "Following..."}
        className={className ?? defaultClassName}
      />
    </form>
  );
}
