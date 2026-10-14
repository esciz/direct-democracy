import { PostCard } from "@/components/domain/post-card";
import { VoteCard } from "@/components/domain/vote-card";
import type { FeedRenderableItem, UserRole } from "@/types/domain";

type PostFeedListProps = {
  items: FeedRenderableItem[];
  viewerRole: UserRole;
  viewerUserId?: string;
  returnPath?: string;
};

export function PostFeedList({ items, viewerRole, viewerUserId, returnPath = "/posts" }: PostFeedListProps) {
  return (
    <div className="space-y-4">
      {items.map((item) =>
        item.itemType === "post" ? (
          <PostCard key={item.id} post={item.post} viewerRole={viewerRole} viewerUserId={viewerUserId} returnPath={returnPath} />
        ) : (
          <VoteCard key={item.id} question={item.question} compact />
        ),
      )}
    </div>
  );
}
