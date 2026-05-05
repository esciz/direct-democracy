import { cookies } from "next/headers";
import { cache } from "react";

type StoredPostReaction = {
  id: string;
  postId: string;
  userId: string;
  reaction: "up" | "down";
  createdAt: string;
};

const POST_REACTIONS_COOKIE = "dd_post_reactions";

function isStoredPostReaction(value: unknown): value is StoredPostReaction {
  if (!value || typeof value !== "object") {
    return false;
  }

  const reaction = value as Record<string, unknown>;

  return (
    typeof reaction.id === "string" &&
    typeof reaction.postId === "string" &&
    typeof reaction.userId === "string" &&
    (reaction.reaction === "up" || reaction.reaction === "down") &&
    typeof reaction.createdAt === "string"
  );
}

export const getStoredPostReactions = cache(async (): Promise<StoredPostReaction[]> => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(POST_REACTIONS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredPostReaction) : [];
  } catch {
    return [];
  }
});

export async function setStoredPostReactions(reactions: StoredPostReaction[]) {
  const cookieStore = await cookies();
  cookieStore.set(POST_REACTIONS_COOKIE, JSON.stringify(reactions.slice(0, 1000)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function applyPostReactionState<
  T extends {
    id: string;
    reactionTotals: {
      up: number;
      down: number;
    };
  },
>(posts: T[], viewerUserId?: string): Promise<Array<T & { viewerReaction: "up" | "down" | null }>> {
  const reactions = await getStoredPostReactions();
  const deltaByPostId = new Map<string, { up: number; down: number }>();
  const viewerReactionByPostId = new Map<string, "up" | "down" | null>();

  for (const reaction of reactions) {
    const current = deltaByPostId.get(reaction.postId) ?? { up: 0, down: 0 };
    current[reaction.reaction] += 1;
    deltaByPostId.set(reaction.postId, current);

    if (viewerUserId && reaction.userId === viewerUserId) {
      viewerReactionByPostId.set(reaction.postId, reaction.reaction);
    }
  }

  return posts.map((post) => {
    const delta = deltaByPostId.get(post.id) ?? { up: 0, down: 0 };

    return {
      ...post,
      reactionTotals: {
        up: Math.max(0, post.reactionTotals.up + delta.up),
        down: Math.max(0, post.reactionTotals.down + delta.down),
      },
      viewerReaction: viewerReactionByPostId.get(post.id) ?? null,
    };
  });
}
