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
    ? "dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold transition hover:border-cyan-300/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
    : "dd-button-primary rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55";

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
