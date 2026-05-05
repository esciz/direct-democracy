import type { PostContentType } from "@/types/domain";

export function getNewsStoryHref(storyId: string) {
  return `/news/${storyId}`;
}

export function getContentDetailHref(item: { id: string; contentType: PostContentType }) {
  return item.contentType === "newsStory" ? getNewsStoryHref(item.id) : `/posts/${item.id}`;
}

export function getTruthDetailHref(item: { id: string; contentType: PostContentType }) {
  return `${getContentDetailHref(item)}#truth`;
}
