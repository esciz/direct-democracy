import { notFound } from "next/navigation";

import { MessageThreadDetail } from "@/components/domain/message-thread-detail";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getMessagingThreadDetail } from "@/lib/messages/store";

type MessageThreadPageProps = {
  params: Promise<{
    threadId: string;
  }>;
  searchParams?: Promise<{
    message?: string;
    messageError?: string;
    messageRequest?: string;
    interview?: string;
  }>;
};

function getStatusMessage(message?: string, messageError?: string, messageRequest?: string, interview?: string) {
  if (message === "sent") {
    return "Your reply was sent.";
  }

  if (messageRequest === "accepted") {
    return "This request was accepted. The conversation is now active.";
  }

  if (messageRequest === "ignored") {
    return "This request was ignored.";
  }

  if (messageRequest === "blocked") {
    return "This sender was blocked for this conversation.";
  }

  if (messageRequest === "reported") {
    return "This conversation was reported for review.";
  }

  if (interview === "accepted") {
    return "This interview request was accepted.";
  }

  if (interview === "declined") {
    return "This interview request was declined.";
  }

  if (interview === "completed") {
    return "This interview was marked completed and is ready to publish.";
  }

  if (interview === "canceled") {
    return "This interview request was canceled.";
  }

  if (messageError === "denied") {
    return "That message action is not available.";
  }

  return undefined;
}

export default async function MessageThreadPage({ params, searchParams }: MessageThreadPageProps) {
  const currentUser = await getCurrentUser();
  const { threadId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const thread = await getMessagingThreadDetail(threadId, currentUser);

  if (!thread) {
    notFound();
  }

  return (
    <div className="py-8">
      <MessageThreadDetail
        thread={thread}
        statusMessage={getStatusMessage(
          resolvedSearchParams?.message,
          resolvedSearchParams?.messageError,
          resolvedSearchParams?.messageRequest,
          resolvedSearchParams?.interview,
        )}
      />
    </div>
  );
}
