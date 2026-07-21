import type { PoliticalAd } from "@/types/domain";

function getYoutubeEmbedUrl(mediaUrl: string | null | undefined) {
  if (!mediaUrl) return null;

  try {
    const parsed = new URL(mediaUrl);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (hostname.includes("youtu.be")) {
      const videoId = parsed.pathname.replace("/", "").split("/")[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    return null;
  } catch {
    return null;
  }
}

function MediaPlaceholder({ ad }: { ad: PoliticalAd }) {
  return (
    <div className="flex min-h-[20rem] flex-col justify-between rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,#111827,#020617)] p-6">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
          Ad media preview
        </span>
        <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
          {ad.electionCycle}
        </span>
      </div>
      <div>
        <p className="max-w-xl text-4xl font-semibold tracking-tight text-white">{ad.title}</p>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">{ad.description}</p>
      </div>
    </div>
  );
}

export function AdMediaViewer({ ad }: { ad: PoliticalAd }) {
  const video = ad.media.find((media) => media.mediaType === "video" && media.url);
  const externalEmbed = ad.media.find((media) => media.mediaType === "externalEmbed" && media.url);
  const youtubeEmbedUrl = getYoutubeEmbedUrl(video?.url ?? externalEmbed?.url ?? ad.platformUrl ?? ad.archiveUrl);
  const image = ad.media.find((media) => media.mediaType === "image" && media.url);
  const audio = ad.media.find((media) => media.mediaType === "audio");
  const pdf = ad.media.find((media) => media.mediaType === "pdf" && media.url);
  const transcriptItems = ad.media.filter((media) => media.mediaType === "transcript" || media.mediaType === "ocrText");

  return (
    <section className="dd-panel rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Media</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Ad creative and transcript</h2>
        </div>
        {pdf ? (
          <a href={pdf.url ?? "#"} className="dd-button-secondary rounded-full px-4 py-2 text-sm font-semibold">
            Open mailer / PDF
          </a>
        ) : null}
        {externalEmbed?.url ? (
          <a href={externalEmbed.url} className="dd-button-secondary rounded-full px-4 py-2 text-sm font-semibold">
            Open source
          </a>
        ) : null}
      </div>

      <div className="mt-5">
        {youtubeEmbedUrl ? (
          <div className="aspect-video overflow-hidden rounded-[1.5rem] border border-white/10 bg-black">
            <iframe
              src={youtubeEmbedUrl}
              title={`${ad.title} video source`}
              className="h-full w-full"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : video ? (
          <video controls preload="metadata" poster={image?.url ?? undefined} className="w-full rounded-[1.5rem] border border-white/10 bg-black">
            <source src={video.url ?? undefined} />
          </video>
        ) : image ? (
          <img src={image.url ?? ""} alt={image.altText ?? ad.title} className="max-h-[34rem] w-full rounded-[1.5rem] border border-white/10 object-cover" />
        ) : (
          <MediaPlaceholder ad={ad} />
        )}
      </div>

      {audio ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Audio</p>
          {audio.url ? (
            <audio controls preload="none" className="w-full" src={audio.url} />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
              Audio capture is indexed in the repository. A playable source file can be attached when the real archive is connected.
            </div>
          )}
        </div>
      ) : null}

      {transcriptItems.length ? (
        <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-cyan-200">Transcript / OCR text</summary>
          <div className="mt-3 space-y-3 text-sm leading-7 text-slate-300">
            {transcriptItems.map((item) => (
              <p key={item.id}>{item.textContent}</p>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
