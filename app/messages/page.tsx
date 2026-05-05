import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";
import { canUserMessagePublicFigures } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/server/auth-session";

type MessagesPageProps = {
  searchParams?: Promise<{
    message?: string;
    messageError?: string;
    tab?: string;
  }>;
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const currentUser = await getCurrentUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const canStartNewConversation = currentUser.role === "official" || canUserMessagePublicFigures(currentUser);
  const activeTab =
    resolvedSearchParams?.tab === "requests" || resolvedSearchParams?.tab === "sent"
      ? resolvedSearchParams.tab
      : "inbox";

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Messages"
        title="Inbox"
        description="Messaging is in recovery mode. Compose and thread routes remain available, but the inbox list is temporarily reduced to a stable shell."
        meta={<span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">Safe mode</span>}
        actions={
          canStartNewConversation ? (
            <Link
              href="/messages/new"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Write a Message
            </Link>
          ) : (
            <Link
              href={`/services?communityId=${currentUser.primaryCommunityId ?? "carson-city"}`}
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Complete voter verification
            </Link>
          )
        }
      />

      {!canStartNewConversation ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          Campus and event participation are open, but messaging officials or candidates unlocks only after voter verification.
        </section>
      ) : null}

      {resolvedSearchParams?.message === "requested" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your message was sent as a request.
        </section>
      ) : null}
      {resolvedSearchParams?.messageError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {resolvedSearchParams.messageError === "sender" && "Voter verification is required before starting a new direct message to an official or candidate."}
          {resolvedSearchParams.messageError !== "sender" && "That message action could not be completed."}
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2 rounded-full bg-slate-50/90 p-1">
          <Link href="/messages?tab=inbox" className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === "inbox" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-ink"}`}>Inbox</Link>
          <Link href="/messages?tab=sent" className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === "sent" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-ink"}`}>Sent</Link>
          <Link href="/messages?tab=requests" className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === "requests" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-ink"}`}>Requests</Link>
        </div>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            {activeTab === "inbox" ? "Inbox" : activeTab === "sent" ? "Sent" : "Requests"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            The full thread list is temporarily disabled while a blocking load issue is being isolated. You can still start a new guided message, open threads directly from notifications, and use direct thread URLs that already exist.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/messages/new" className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
              Write a Message
            </Link>
            <Link href="/notifications" className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
              Open notifications
            </Link>
          </div>
        </section>
      </section>
    </div>
  );
}
