import "server-only";

import { getPostById } from "@/lib/feed/posts";

export async function getNewsStoryById(storyId: string, viewerUserId?: string) {
  const post = await getPostById(storyId, viewerUserId);

  if (!post || post.contentType !== "newsStory") {
    return null;
  }

  return post;
}
