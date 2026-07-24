import { notFound } from "next/navigation";

import { PetitionDetail } from "@/components/domain/petition-detail";
import { isGuestUser } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getContactOfficialsPanelData } from "@/lib/contact/store";
import { getDraftLegislationByPetitionId } from "@/lib/petitions/legislation";
import { getPetitionById } from "@/lib/petitions/store";
import { getStoredPollVotes } from "@/lib/polls/store";

type PetitionDetailPageProps = {
  params: Promise<{
    petitionId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    signed?: string;
    sponsorship?: string;
    drafting?: string;
    fromPollNotification?: string;
    pollId?: string;
  }>;
};

function getStatusMessage(error?: string, signed?: string, sponsorship?: string, drafting?: string) {
  if (signed === "success") {
    return "Your signature was added successfully.";
  }

  if (signed === "already") {
    return "You have already signed this petition.";
  }

  if (error === "verification") {
    return "Only verified users can sign petitions.";
  }

  if (error === "jurisdiction") {
    return "This petition can only be signed by verified users in the matching jurisdiction.";
  }

  if (error === "petition") {
    return "That petition could not be found.";
  }

  if (error === "permissions") {
    return "Only officials or admins can start drafting for a sponsored petition.";
  }

  if (error === "sponsorship") {
    return "A petition needs a public sponsor request before drafting can begin.";
  }

  if (sponsorship === "success") {
    return "Your public sponsorship request was posted successfully.";
  }

  if (sponsorship === "already") {
    return "You have already posted a sponsorship request for this petition.";
  }

  if (drafting === "started") {
    return "Drafting has started. Petition signers were notified of the update.";
  }

  return undefined;
}

export default async function PetitionDetailPage({ params, searchParams }: PetitionDetailPageProps) {
  const user = await getCurrentUser();
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [petition, draftLegislation] = await Promise.all([
    getPetitionById(resolvedParams.petitionId, user),
    getDraftLegislationByPetitionId(resolvedParams.petitionId),
  ]);

  if (!petition) {
    notFound();
  }

  const contactPanel = await getContactOfficialsPanelData({
    entityId: petition.id,
    entityType: "petition",
    contextTitle: petition.title,
    contextSummary: petition.summary,
    jurisdictionName: petition.jurisdictionName,
    issueLabels: [petition.title, petition.summary],
    userName: user.name,
    preferredOfficialIds: draftLegislation ? [draftLegislation.sponsorOfficialId] : petition.sponsorshipRequests.flatMap((request) => request.targetedOfficialIds),
  });
  const votedOnRelatedPoll =
    resolvedSearchParams?.fromPollNotification === "1" && typeof resolvedSearchParams.pollId === "string"
      ? (await getStoredPollVotes()).some(
          (vote) => vote.pollId === resolvedSearchParams.pollId && vote.userId === user.id,
        )
      : false;

  return (
    <div className="space-y-6 py-8">
      <PetitionDetail
        petition={petition}
        draftLegislation={draftLegislation}
        contactPanel={contactPanel}
        guestMode={isGuestUser(user)}
        continuityMessage={votedOnRelatedPoll ? "You voted on this issue earlier. That earlier signal helped this move into a petition." : undefined}
        statusMessage={getStatusMessage(
          resolvedSearchParams?.error,
          resolvedSearchParams?.signed,
          resolvedSearchParams?.sponsorship,
          resolvedSearchParams?.drafting,
        )}
      />
    </div>
  );
}
