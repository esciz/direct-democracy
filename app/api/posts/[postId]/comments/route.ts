import { NextResponse } from "next/server";

import { getCurrentFeedViewer } from "@/lib/server/auth-session";
import { getCommentsForPost } from "@/lib/feed/comments";
import { getReportedTargetIdsForUser } from "@/lib/server/content-reports";

type RouteContext = {
  params: Promise<{
    postId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { postId } = await context.params;

  if (!postId) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const comments = await getCommentsForPost(postId);
    let reportedCommentIds = new Set<string>();

    try {
      const viewer = await getCurrentFeedViewer();
      reportedCommentIds = await getReportedTargetIdsForUser(viewer.id, "comment");
    } catch (error) {
      console.error(`[api/comments] viewer lookup failed for ${postId}`, error);
    }

    const previews = comments
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 3);

    return NextResponse.json({
      totalCount: comments.length,
      comments: previews.map((comment) => ({
        ...comment,
        viewerHasReported: reportedCommentIds.has(comment.id),
      })),
    });
  } catch (error) {
    console.error(`[api/comments] failed for ${postId}`, error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
