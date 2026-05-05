import Link from "next/link";
import { notFound } from "next/navigation";

import { ContactOfficialsPanel } from "@/components/domain/contact-officials-panel";
import { DebateCard } from "@/components/domain/debate-card";
import { IssueLifecycleMap } from "@/components/domain/issue-lifecycle-map";
import { OfficialActionCard } from "@/components/domain/official-action-card";
import { OrganizationCard } from "@/components/domain/organization-card";
import { PostCard } from "@/components/domain/post-card";
import { TopIssueCard } from "@/components/domain/top-issue-card";
import { TopVoiceCard } from "@/components/domain/top-voice-card";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { canUserCreateDebate } from "@/lib/auth/guards";
import { getDefaultCommunityForJurisdiction } from "@/lib/community/communities";
import { getContactOfficialsPanelData } from "@/lib/contact/store";
import { getIssueLifecycle } from "@/lib/community/lifecycle";
import { getTopIssueById } from "@/lib/community/issues";
import { getFeedPosts } from "@/lib/feed/posts";
import { getDebatesForUser } from "@/lib/debates/store";
import { getOfficialActionsForIssue } from "@/lib/officials/action-store";
import { getOrganizationsForCommunity } from "@/lib/organizations/store";
import { getTopVoices } from "@/lib/profile/details";
import { followIssue, unfollowIssue } from "@/lib/social/actions";
import { getIssueFollowState } from "@/lib/social/follows";

type TopIssueDetailPageProps = {
  params: Promise<{
    issueId: string;
  }>;
  searchParams?: Promise<{
    issueFollow?: string;
    officialActionReaction?: string;
    officialActionError?: string;
  }>;
};

export default async function TopIssueDetailPage({ params, searchParams }: TopIssueDetailPageProps) {
  const { issueId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const user = await getCurrentUser();
  const viewerCanCreateDebate = canUserCreateDebate(user);
  const issueData = await getTopIssueById(user, issueId);

  if (!issueData) {
    notFound();
  }

  const lifecycle = getIssueLifecycle(issueData.issue, issueData.relatedPetition);
  const communityId = getDefaultCommunityForJurisdiction(issueData.issue.jurisdictionName).id;
  const issueFollowState = await getIssueFollowState(user.id, issueData.issue.id);
  const topVoices = await getTopVoices(user, communityId, issueData.issue.scope, undefined, {
    issueText: issueData.issue.issueText,
    limit: 4,
  });
  const contactPanel = await getContactOfficialsPanelData({
    entityId: issueData.issue.id,
    entityType: "issue",
    contextTitle: issueData.issue.issueText,
    contextSummary: issueData.relatedPetition?.summary ?? `Community members are elevating ${issueData.issue.issueText} as a priority in ${issueData.issue.jurisdictionName}.`,
    jurisdictionName: issueData.issue.jurisdictionName,
    issueLabels: [issueData.issue.issueText],
    userName: user.name,
  });
  const officialActions = await getOfficialActionsForIssue(issueData.issue.issueText, issueData.issue.jurisdictionName, user.id, 4);
  const debates = await getDebatesForUser(user, { issueId: issueData.issue.id, status: "all" });
  const relatedOrganizations = await getOrganizationsForCommunity(user, communityId, issueData.issue.issueText);
  const mediaCoverage = (await getFeedPosts("forYou", user.id))
    .filter((post) => {
      if (post.authorRole !== "media" || post.contentType !== "newsStory") {
        return false;
      }

      const haystack = `${post.title ?? ""} ${post.content}`.toLowerCase();
      const tokens = issueData.issue.issueText
        .toLowerCase()
        .split(/\W+/)
        .filter((token) => token.length > 3);

      return post.jurisdictionName === issueData.issue.jurisdictionName || tokens.some((token) => haystack.includes(token));
    })
    .slice(0, 2);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Issue"
        title={issueData.issue.issueText}
        description="Track how a community issue is moving from public concern into petition and sponsorship stages."
        actions={
          <form action={issueFollowState.viewerIsFollowing ? unfollowIssue : followIssue}>
            <input type="hidden" name="issueId" value={issueData.issue.id} />
            <input type="hidden" name="returnPath" value={`/top-issues/${issueData.issue.id}`} />
            <FormSubmitButton
              idleLabel={issueFollowState.viewerIsFollowing ? `Following issue (${issueFollowState.followCount})` : "Follow issue"}
              pendingLabel="Updating..."
              className={
                issueFollowState.viewerIsFollowing
                  ? "rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                  : "rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700"
              }
            />
          </form>
        }
      />
      {resolvedSearchParams?.issueFollow ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          {resolvedSearchParams.issueFollow === "success" && "This issue was added to your followed issues."}
          {resolvedSearchParams.issueFollow === "removed" && "This issue was removed from your followed issues."}
          {resolvedSearchParams.issueFollow === "exists" && "You are already following this issue."}
        </section>
      ) : null}
      {resolvedSearchParams?.officialActionReaction ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          {resolvedSearchParams.officialActionReaction === "support" && "Your support reaction was recorded for that official action."}
          {resolvedSearchParams.officialActionReaction === "oppose" && "Your oppose reaction was recorded for that official action."}
        </section>
      ) : null}
      {resolvedSearchParams?.officialActionError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {resolvedSearchParams.officialActionError === "denied" && "You must be a verified voter to react to official actions."}
          {resolvedSearchParams.officialActionError === "invalid" && "That official action reaction could not be saved. Please try again."}
        </section>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <TopIssueCard issue={issueData.issue} returnPath={`/top-issues/${issueData.issue.id}`} />
        <IssueLifecycleMap lifecycle={lifecycle} />
      </div>
      {issueData.relatedPetition ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Related petition</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{issueData.relatedPetition.title}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{issueData.relatedPetition.summary}</p>
          <Link
            href={`/petitions/${issueData.relatedPetition.id}`}
            className="mt-5 inline-flex rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700"
          >
            View petition
          </Link>
        </section>
      ) : null}
      {officialActions.length ? (
        <section className="space-y-4">
          <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Official actions</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">How officeholders have acted on this issue</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                These cards separate source type from verification status so users can see what is official, what is sourced, and what is still community-submitted.
              </p>
            </div>
          </div>
          <div className="grid gap-4">
            {officialActions.map((action) => (
              <OfficialActionCard key={action.id} action={action} returnPath={`/top-issues/${issueData.issue.id}`} compact />
            ))}
          </div>
        </section>
      ) : null}
      {topVoices.length ? (
        <section className="space-y-4">
          <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Top voices</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">People shaping this issue</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  These voices are featured because their issue coverage is credible, engaged, and visible in the community.
                </p>
              </div>
              <Link
                href={`/people?communityId=${communityId}&scope=${issueData.issue.scope}&q=${encodeURIComponent(issueData.issue.issueText)}`}
                className="text-sm font-semibold text-civic-700 hover:text-civic-900"
              >
                Browse related people
              </Link>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {topVoices.map((voice) => (
              <TopVoiceCard key={voice.id} voice={voice} returnPath={`/top-issues/${issueData.issue.id}`} />
            ))}
          </div>
        </section>
      ) : null}
      {relatedOrganizations.length ? (
        <section className="space-y-4">
          <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Organizations</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Groups organizing around this issue</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Structured groups can turn shared issue interest into events, endorsements, platform votes, debates, and public action.
                </p>
              </div>
              <Link href={`/organizations?communityId=${communityId}`} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
                Browse organizations
              </Link>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {relatedOrganizations.map((organization) => (
              <OrganizationCard key={organization.id} organization={organization} />
            ))}
          </div>
        </section>
      ) : null}
      {mediaCoverage.length ? (
        <section className="space-y-4">
          <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Media coverage</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">News stories connected to this issue</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Media coverage is shown separately from official statements, with user-rated bias and community truth signals visible on each story.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-4">
            {mediaCoverage.map((post) => (
              <PostCard key={post.id} post={post} viewerRole={user.role} viewerUserId={user.id} returnPath={`/top-issues/${issueData.issue.id}`} />
            ))}
          </div>
        </section>
      ) : null}
      {debates.length ? (
        <section className="space-y-4">
          <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Structured debates</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Turn-based arguments on this issue</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Trusted Citizens can debate this issue in a fixed sequence, while the wider community reacts to each official statement.
                </p>
              </div>
              <Link
                href={`/debates?issueId=${issueData.issue.id}`}
                className="text-sm font-semibold text-civic-700 hover:text-civic-900"
              >
                View all debates
              </Link>
              {viewerCanCreateDebate ? (
                <Link
                  href={`/debates/new?issueId=${issueData.issue.id}`}
                  className="text-sm font-semibold text-civic-700 hover:text-civic-900"
                >
                  Start debate
                </Link>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {debates.slice(0, 2).map((debate) => (
              <DebateCard key={debate.id} debate={debate} />
            ))}
          </div>
        </section>
      ) : null}
      <ContactOfficialsPanel panel={contactPanel} />
    </div>
  );
}
