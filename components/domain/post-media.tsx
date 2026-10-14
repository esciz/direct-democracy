type PostMediaProps = {
  postType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO";
  mediaUrl?: string;
  title?: string;
};

function getYoutubeEmbedUrl(mediaUrl: string) {
  try {
    const parsed = new URL(mediaUrl);

    if (parsed.hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (parsed.hostname.includes("youtu.be")) {
      const videoId = parsed.pathname.replace("/", "");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function PostMedia({ postType, mediaUrl, title }: PostMediaProps) {
  if (!mediaUrl || postType === "TEXT") {
    return null;
  }

  if (postType === "IMAGE") {
    return (
      <div className="mt-5 overflow-hidden rounded-[1.5rem] ring-1 ring-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaUrl} alt={title ?? "Post image"} className="h-auto w-full object-cover" />
      </div>
    );
  }

  if (postType === "AUDIO") {
    return (
      <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
        <audio controls preload="metadata" className="w-full" src={mediaUrl}>
          Your browser does not support the audio tag.
        </audio>
      </div>
    );
  }

  const youtubeEmbedUrl = getYoutubeEmbedUrl(mediaUrl);

  if (youtubeEmbedUrl) {
    return (
      <div className="mt-5 aspect-video overflow-hidden rounded-[1.5rem] bg-slate-950 ring-1 ring-slate-200">
        <iframe
          src={youtubeEmbedUrl}
          title={title ?? "Embedded video"}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-hidden rounded-[1.5rem] bg-slate-950 ring-1 ring-slate-200">
      <video controls preload="metadata" className="aspect-video w-full" src={mediaUrl}>
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
