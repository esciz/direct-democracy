"use client";

import Link from "next/link";
import { useState } from "react";

import { ContentReportControl } from "@/components/domain/content-report-control";
import { ActionLabel, CommentBubbleIcon, CommentSpeakIcon } from "@/components/ui/action-icons";
import { canUserCommentOnPostsClient } from "@/lib/auth/client-guards";
import type { UserRole } from "@/types/domain";

type FeedPostCommentsPanelProps = {
  postId: string;
  viewerRole: UserRole;
  initialCommentCount?: number;
  detailHref?: string;
  guestMode?: boolean;
};

type CommentPreview = {
  id: string;
  authorName: string;
  authorRole: string;
  content: string;
  mediaType?: "IMAGE";
  mediaUrl?: string;
  createdAt: string;
  viewerHasReported?: boolean;
};

type CommentResponse = {
  totalCount: number;
  comments: CommentPreview[];
};

function formatCommentTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FeedPostCommentsPanel({
  postId,
  viewerRole,
  initialCommentCount = 0,
  detailHref = `/posts/${postId}`,
  guestMode = false,
}: FeedPostCommentsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CommentResponse | null>(null);
  const canComment = !guestMode && canUserCommentOnPostsClient({ role: viewerRole });
  const commentCount = data?.totalCount ?? initialCommentCount;

  async function toggleComments(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const nextExpanded = !expanded;
    setExpanded(nextExpanded);

    if (!nextExpanded || data || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("failed");
      }

      const nextData = (await response.json()) as CommentResponse;
      setData(nextData);
    } catch (fetchError) {
      console.error(`[feed-comments] failed for ${postId}`, fetchError);
      setError("Comments could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-start gap-3">
        {canComment ? (
          <Link
            href={`${detailHref}#comments`}
            aria-label="Add a comment"
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            <ActionLabel icon={<CommentSpeakIcon className="h-4 w-4" />}>Comment</ActionLabel>
          </Link>
        ) : null}
        <button
          type="button"
          onClick={toggleComments}
          aria-label={expanded ? "Hide comments" : "Open comments"}
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          <ActionLabel icon={<CommentBubbleIcon className="h-4 w-4" />}>{expanded ? `Hide Comments ${commentCount}` : `Comments ${commentCount}`}</ActionLabel>
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
          {loading ? (
            <p className="text-sm text-slate-600">Loading comments...</p>
          ) : error ? (
            <p className="text-sm text-slate-600">{error}</p>
          ) : data ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Comments</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {data.totalCount} total
                </span>
              </div>
              {data.comments.length ? (
                data.comments.map((comment) => (
                  <article key={comment.id} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-ink">{comment.authorName}</span>
                        <span>{comment.authorRole}</span>
                        <span>{formatCommentTime(comment.createdAt)}</span>
                      </div>
                      {!guestMode ? (
                        <ContentReportControl
                          targetType="comment"
                          targetId={comment.id}
                          initialReported={Boolean(comment.viewerHasReported)}
                          compact
                        />
                      ) : null}
                    </div>
                    {comment.content ? <p className="mt-2 text-sm leading-6 text-slate-700">{comment.content}</p> : null}
                    {comment.mediaType === "IMAGE" && comment.mediaUrl ? (
                      <div className="mt-3 overflow-hidden rounded-[1rem] ring-1 ring-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={comment.mediaUrl}
                          alt={`${comment.authorName} attached image`}
                          loading="lazy"
                          className="max-h-72 w-full object-cover"
                        />
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="text-sm text-slate-600">No comments yet.</p>
              )}
              <Link href={`${detailHref}#comments`} className="inline-flex text-sm font-semibold text-civic-700 hover:text-civic-900">
                <ActionLabel icon={<CommentBubbleIcon className="h-4 w-4" />}>View all comments</ActionLabel>
              </Link>
              {guestMode ? <p className="text-xs text-slate-500">Guest Browse is read-only.</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
