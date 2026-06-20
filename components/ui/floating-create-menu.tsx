import { canUserCreateCommunityEvent, canUserCreateDebate, canUserMessagePublicFigures, canUserSignPetitions, canUserVote } from "@/lib/auth/guards";
import { isGuestUser } from "@/lib/auth/session";
import { getCurrentSessionUser } from "@/lib/server/auth-session";
import { canUserCreatePoll, canUserCreatePublicPost } from "@/lib/server/auth-guards";

import { FloatingCreateMenuClient, type FloatingCreateAction } from "@/components/ui/floating-create-menu-client";

function canUserCreateOrganization(user: NonNullable<Awaited<ReturnType<typeof getCurrentSessionUser>>>) {
  return user.role === "citizen" || user.role === "trustedCitizen" || user.role === "admin";
}

export async function FloatingCreateMenu() {
  const user = await getCurrentSessionUser();

  if (!user || isGuestUser(user)) {
    return null;
  }

  const [canCreatePost, canCreatePoll, canCreateEvent] = await Promise.all([
    canUserCreatePublicPost(user),
    canUserCreatePoll(user),
    canUserCreateCommunityEvent(user),
  ]);

  const actions: FloatingCreateAction[] = [];

  if (canCreatePost) {
    actions.push({
      href: "/posts/create",
      label: "Create Perspective",
      description: "Publish a civic brief tied to a real community, issue, or public figure.",
      group: "Publish",
    });
  }

  if (canCreatePoll) {
    actions.push({
      href: "/polls/create",
      label: "Start Poll",
      description: "Ask a structured question tied to a specific civic context.",
      group: "Publish",
    });
  }

  if (canUserSignPetitions(user)) {
    actions.push({
      href: "/petitions/create",
      label: "Create Petition",
      description: "Launch a jurisdiction petition for signatures.",
      group: "Organize",
    });
  }

  if (canUserCreateDebate(user)) {
    actions.push({
      href: "/debates/new",
      label: "Start Debate",
      description: "Set up a two-side civic debate.",
      group: "Organize",
    });
  }

  if (canCreateEvent) {
    actions.push({
      href: "/events/create",
      label: "Create Event",
      description: "Create or propose a civic event.",
      group: "Organize",
    });
  }

  if (canUserCreateOrganization(user)) {
    actions.push({
      href: "/organizations/create",
      label: "Create Organization",
      description: "Start or request a civic coalition.",
      group: "Organize",
    });
  }

  if (user.role === "official" || canUserMessagePublicFigures(user)) {
    actions.push({
      href: "/messages/new",
      label: "Write Message",
      description: "Contact officials or candidates through the guided flow.",
      group: "Outreach",
    });
  }

  if (canUserVote(user)) {
    actions.push({
      href: "/support-statements/new",
      label: "Write Statement of Support",
      description: "Add a public support statement tied to an issue or action.",
      group: "Outreach",
    });
    actions.push({
      href: "/cases/submit",
      label: "Submit Case",
      description: "Route a verified public-interest case into review.",
      group: "Outreach",
    });
  }

  return <FloatingCreateMenuClient actions={actions} />;
}
