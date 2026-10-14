import { IssueFollowButton } from "@/components/domain/issue-follow-button";
import { isGuestUser } from "@/lib/auth/session";
import { getCurrentSessionUser } from "@/lib/server/auth-session";
import { getFavoriteForCurrentViewer } from "@/lib/server/favorites";

type IssueFollowControlProps = {
  targetId: string;
};

export async function IssueFollowControl({ targetId }: IssueFollowControlProps) {
  const currentUser = await getCurrentSessionUser();

  if (!currentUser || isGuestUser(currentUser)) {
    return (
      <a
        href="/get-started?step=account"
        className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
      >
        Sign in to follow
      </a>
    );
  }

  const existingFollow = await getFavoriteForCurrentViewer("issue", targetId);
  const initialStance = existingFollow?.stance ?? (existingFollow ? "tracking" : null);

  return <IssueFollowButton targetId={targetId} initialStance={initialStance} />;
}
