import { PostCard } from "@/components/domain/post-card";
import type { PostSummary, UserRole } from "@/types/domain";

type OfficialRecentPostsProps = {
  posts: PostSummary[];
  isClaimed?: boolean;
  viewerRole: UserRole;
  viewerUserId?: string;
  returnPath: string;
};

export function OfficialRecentPosts({ posts, isClaimed, viewerRole, viewerUserId, returnPath }: OfficialRecentPostsProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Perspectives and updates</h2>
        <p className="mt-2 text-sm text-slate-600">
          {isClaimed ? "Recent statements, updates, and explanations from this official in their relevant civic contexts." : "This profile is unclaimed, so there is no linked posting account yet."}
        </p>
      </div>
      <div className="space-y-4">
        {posts.length ? (
          posts.map((post) => <PostCard key={post.id} post={post} viewerRole={viewerRole} viewerUserId={viewerUserId} returnPath={returnPath} />)
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 shadow-card">
            No public perspectives yet.
          </div>
        )}
      </div>
    </section>
  );
}
