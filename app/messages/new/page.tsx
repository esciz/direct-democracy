import { notFound } from "next/navigation";

import { GuidedMessageFlow } from "@/components/domain/guided-message-flow";
import { NewMessageForm } from "@/components/domain/new-message-form";
import { PageIntro } from "@/components/ui/page-intro";
import { canUserMessagePublicFigures } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/server/auth-session";
import { canStartConversation, getGuidedMessageRecipients, getMessageComposerIssues, getMessagingSettings } from "@/lib/messages/store";
import { canUserCreateInterviewRequest } from "@/lib/server/interviews";

type NewMessagePageProps = {
  searchParams?: Promise<{
    recipientUserId?: string;
    messageError?: string;
  }>;
};

export default async function NewMessagePage({ searchParams }: NewMessagePageProps) {
  const currentUser = await getCurrentUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const issues = await getMessageComposerIssues(currentUser);
  const canMessage = currentUser.role === "official" || canUserMessagePublicFigures(currentUser);
  const canRequestInterview = canUserCreateInterviewRequest(currentUser);

  if (!resolvedSearchParams?.recipientUserId) {
    const recipients = await getGuidedMessageRecipients(currentUser);

    return (
      <div className="space-y-6 py-8">
        <PageIntro
          eyebrow="New message"
          title="Write a message"
          description="Choose the right level, route by office or issue, and then compose a verified civic message to the best public recipient."
        />
        {!canMessage ? (
          <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
            Voter verification is required before contacting officials or candidates directly. Campus participation and event activity stay open, but civic messaging unlocks after verification.
          </section>
        ) : null}
        {canMessage ? (
        <GuidedMessageFlow
          recipients={recipients}
          issues={issues.map((issue) => ({ id: issue.id, issueText: issue.issueText })).slice(0, 12)}
          canRequestInterview={canRequestInterview}
        />
        ) : null}
      </div>
    );
  }

  const eligibility = await canStartConversation(currentUser, resolvedSearchParams.recipientUserId);

  if (!eligibility.recipient) {
    notFound();
  }

  const settings = await getMessagingSettings(resolvedSearchParams.recipientUserId);
  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="New message"
        title={`Message ${eligibility.recipient.name}`}
        description="Messaging is tied to verified identities and limited to civic conversations between citizens and public figures, plus direct official-to-official coordination."
      />

      {!eligibility.allowed ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {eligibility.reason === "followersOnly" && "This public figure only accepts first-time messages from followers."}
          {eligibility.reason === "jurisdictionOnly" && "This public figure only accepts first-time messages from people in the same jurisdiction."}
          {eligibility.reason === "sender" && "Voter verification is required before starting a new civic message to an official or candidate."}
          {eligibility.reason === "recipient" && "That recipient is not available for civic messaging."}
          {eligibility.reason === "profile" && "That profile cannot receive direct messages right now."}
        </section>
      ) : (
        <NewMessageForm
          recipientUserId={eligibility.recipient.id}
          recipientName={eligibility.recipient.name}
          recipientRole={eligibility.recipient.role === "official" ? "official" : "candidate"}
          recipientJurisdiction={eligibility.recipient.jurisdictionName}
          audienceRule={settings.audienceRule}
          title="Direct compose"
          allowInterviewRequests={canRequestInterview}
          issues={issues.map((issue) => ({ id: issue.id, issueText: issue.issueText })).slice(0, 12)}
        />
      )}
    </div>
  );
}
