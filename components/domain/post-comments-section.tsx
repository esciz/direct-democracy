import { ContentReportControlServer } from "@/components/domain/content-report-control-server";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { ActionLabel, CommentBubbleIcon, CommentSpeakIcon } from "@/components/ui/action-icons";
import { addPostComment } from "@/lib/feed/comment-actions";
import { canUserCommentOnPosts } from "@/lib/auth/guards";
import { isGuestUserId } from "@/lib/auth/session";
import { MAX_COMMENTS_PER_USER_PER_POST } from "@/lib/feed/comments";
import { RoleBadge } from "@/components/domain/role-badge";
import type { CommentSummary, UserRole } from "@/types/domain";

type PostCommentsSectionProps = {
  postId: string;
  comments: CommentSummary[];
  viewerRole: UserRole;
  viewerUserId?: string;
  returnPath: string;
};

export function PostCommentsSection({ postId, comments, viewerRole, viewerUserId, returnPath }: PostCommentsSectionProps) {
  const isGuestViewer = isGuestUserId(viewerUserId);
  const canComment = canUserCommentOnPosts({ role: viewerRole });

  return (
    <section className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
            <span className="inline-flex items-center gap-1.5">
              <CommentBubbleIcon className="h-3.5 w-3.5" />
              <span>Community Commentary</span>
            </span>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Flat commentary from trusted citizens, candidates, and officials. Citizens can read, but not post, in MVP.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          {comments.length} comment{comments.length === 1 ? "" : "s"}
        </span>
      </div>

      {comments.length ? (
        <div className="mt-4 space-y-3">
          {comments.map((comment) => (
            <article key={comment.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{comment.authorName}</p>
                  <RoleBadge role={comment.authorRole} />
                  <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                    {new Date(comment.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {viewerUserId && !isGuestViewer ? (
                  <ContentReportControlServer userId={viewerUserId} targetType="comment" targetId={comment.id} compact />
                ) : null}
              </div>
              {comment.content ? <p className="mt-3 text-sm leading-6 text-slate-700">{comment.content}</p> : null}
              {comment.mediaType === "IMAGE" && comment.mediaUrl ? (
                <div className="mt-3 overflow-hidden rounded-[1.25rem] ring-1 ring-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={comment.mediaUrl}
                    alt={`${comment.authorName} attached image`}
                    loading="lazy"
                    className="max-h-96 w-full object-cover"
                  />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">
          No commentary yet. Trusted community voices can add the first perspective here.
        </div>
      )}

      {canComment ? (
        <form action={addPostComment} className="mt-4 space-y-3">
          <input type="hidden" name="postId" value={postId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <div>
            <label htmlFor={`comment-${postId}`} className="text-sm font-semibold text-ink">
              Add a trusted perspective
            </label>
            <textarea
              id={`comment-${postId}`}
              name="content"
              rows={3}
              maxLength={280}
              placeholder="Add one concise, useful perspective."
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
            />
            <p className="mt-2 text-xs text-slate-500">
              Up to {MAX_COMMENTS_PER_USER_PER_POST} comments per post. Keep it short, useful, and specific.
            </p>
          </div>
          <div>
            <label htmlFor={`comment-media-${postId}`} className="text-sm font-semibold text-ink">
              Meme / image URL
            </label>
            <input
              id={`comment-media-${postId}`}
              name="mediaUrl"
              type="url"
              placeholder="https://example.com/meme.png"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
            />
            <p className="mt-2 text-xs text-slate-500">
              Add one meme or image attachment with an optional caption. Public commentary rules and reporting still apply.
            </p>
          </div>
          <FormSubmitButton
            idleLabel={<ActionLabel icon={<CommentSpeakIcon className="h-4 w-4" />}>Post commentary</ActionLabel>}
            pendingLabel={<ActionLabel icon={<CommentSpeakIcon className="h-4 w-4" />}>Posting...</ActionLabel>}
            className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          />
        </form>
      ) : isGuestViewer ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">
          You are browsing in guest mode. Create an account and verify to join public commentary.
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">
          Commentary is limited to trusted citizens, candidates, and officials in MVP. Citizens can read comments but cannot post yet.
        </div>
      )}
    </section>
  );
}
