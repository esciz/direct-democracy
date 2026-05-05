import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CandidateDraftEditor } from "@/components/domain/candidate-draft-editor";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { buildDefaultCandidateDraft } from "@/lib/candidates/drafts";
import { getElectionById } from "@/lib/server/elections-context";
import { getUserProfileContent, getStructuredValueText } from "@/lib/profile/details";
import { getUserSocialSummary } from "@/lib/social/follows";

type RunForOfficeRaceDetailPageProps = {
  params: Promise<{
    electionId: string;
  }>;
  searchParams?: Promise<{
    saved?: string;
    error?: string;
  }>;
};

function getPreviewIssues(jurisdictionName: string, localIssues: string[], stateIssues: string[], nationalIssues: string[]) {
  if (jurisdictionName === "United States") {
    return nationalIssues.slice(0, 3);
  }

  if (jurisdictionName === "Nevada") {
    return stateIssues.slice(0, 3);
  }

  return localIssues.slice(0, 3);
}

export default async function RunForOfficeRaceDetailPage({ params, searchParams }: RunForOfficeRaceDetailPageProps) {
  const currentUser = await getCurrentUser();

  if (currentUser.role !== "trustedCitizen") {
    redirect("/run-for-office");
  }

  const { electionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [election, draft, social, profileContent] = await Promise.all([
    getElectionById(electionId),
    buildDefaultCandidateDraft(currentUser, electionId),
    getUserSocialSummary(currentUser.id, currentUser.followerCount),
    getUserProfileContent(currentUser.id),
  ]);

  if (!election || !draft) {
    notFound();
  }

  const localIssues = profileContent.localIssues.map(getStructuredValueText);
  const stateIssues = profileContent.stateIssues.map(getStructuredValueText);
  const nationalIssues = profileContent.nationalIssues.map(getStructuredValueText);
  const previewIssues = getPreviewIssues(election.jurisdictionName, localIssues, stateIssues, nationalIssues);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Candidate preview"
        title={`Explore ${election.officeTitle}`}
        description="Review the race, sketch your platform presence, and decide whether to keep this private draft or publish a public candidate profile on the platform."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {election.jurisdictionName}
            </span>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              {new Date(`${election.electionDate}T12:00:00Z`).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </>
        }
        actions={
          <Link
            href="/run-for-office/races"
            className="inline-flex rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Back to races
          </Link>
        }
      />

      {resolvedSearchParams?.error ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          Something prevented that draft update. Please try again from this race page.
        </section>
      ) : null}

      <CandidateDraftEditor
        draft={draft}
        followerCount={social.followerCount}
        endorsementCount={0}
        topIssues={previewIssues}
        userName={currentUser.name}
        successState={resolvedSearchParams?.saved === "draft" ? "draft" : null}
      />
    </div>
  );
}
