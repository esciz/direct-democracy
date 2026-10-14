import Link from "next/link";

import type { MessageThreadSummary } from "@/types/domain";

type MessagingThreadCardProps = {
  thread: MessageThreadSummary;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function MessagingThreadCard({ thread }: MessagingThreadCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
          {thread.participantRole}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
          {thread.requestState}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-semibold tracking-tight text-ink">{thread.participantName}</h3>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{thread.jurisdictionName}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{thread.latestMessagePreview}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em] text-slate-500">
        <span>{formatTimestamp(thread.latestMessageAt)}</span>
        {thread.unreadCount ? <span>{thread.unreadCount} new</span> : null}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/messages/${thread.id}`} className="text-sm font-semibold text-civic-700 transition hover:text-civic-900">
          Open conversation
        </Link>
        <Link href={thread.participantProfileHref} className="text-sm font-semibold text-slate-600 transition hover:text-ink">
          View profile
        </Link>
      </div>
    </article>
  );
}
