import { ContentReportControl } from "@/components/domain/content-report-control";
import { isGuestUserId } from "@/lib/auth/session";
import { hasUserReportedTarget } from "@/lib/server/content-reports";
import type { ModerationReportTargetType } from "@/types/domain";

type ContentReportControlServerProps = {
  userId: string;
  targetType: ModerationReportTargetType;
  targetId: string;
  compact?: boolean;
};

export async function ContentReportControlServer({
  userId,
  targetType,
  targetId,
  compact = false,
}: ContentReportControlServerProps) {
  if (isGuestUserId(userId)) {
    return null;
  }

  const initialReported = await hasUserReportedTarget(userId, targetType, targetId);

  return (
    <ContentReportControl
      targetType={targetType}
      targetId={targetId}
      initialReported={initialReported}
      compact={compact}
    />
  );
}
