import { notFound } from "next/navigation";

import { CaseDetail } from "@/components/domain/case-detail";
import { PageIntro } from "@/components/ui/page-intro";
import { getDefaultSeedUser } from "@/lib/auth/mock-users";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCaseById } from "@/lib/cases/store";
import { getCaseVoteQuestion } from "@/lib/votes/profile-sentiment";

type CaseDetailPageProps = {
  params: Promise<{
    caseId: string;
  }>;
  searchParams?: Promise<{
    follow?: string;
    support?: string;
    theme?: string;
    themeSupport?: string;
    error?: string;
    truth?: string;
    truthError?: string;
  }>;
};

function withSectionTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 1800): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

export default async function CaseDetailPage({ params, searchParams }: CaseDetailPageProps) {
  const { caseId } = await params;
  const [caseItem, resolvedSearchParams] = await Promise.all([getCaseById(caseId), searchParams ? searchParams : Promise.resolve(undefined)]);

  if (!caseItem) {
    notFound();
  }

  const returnPath = `/cases/${caseId}`;

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Case"
        title={caseItem.title}
        description="Reviewed public court record. Direct Democracy shows stored public metadata only and does not provide legal advice."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {caseItem.jurisdictionName}
            </span>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              Public data only
            </span>
          </>
        }
      />

      {resolvedSearchParams?.follow ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Case follow status updated.
        </section>
      ) : null}
      {resolvedSearchParams?.support === "saved" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your support statement was saved.
        </section>
      ) : null}
      {resolvedSearchParams?.theme === "created" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your community brief theme was added.
        </section>
      ) : null}
      {resolvedSearchParams?.themeSupport ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Theme support updated.
        </section>
      ) : null}
      {resolvedSearchParams?.error ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          That case action could not be completed. Check the form inputs or permissions and try again.
        </section>
      ) : null}
      {resolvedSearchParams?.truth === "saved" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your community-rated accuracy response was saved.
        </section>
      ) : null}
      {resolvedSearchParams?.truthError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {resolvedSearchParams.truthError === "denied" && "Only trusted citizens, candidates, and officials can submit truth ratings."}
          {resolvedSearchParams.truthError === "invalid" && "That truth rating could not be saved. Please try again."}
        </section>
      ) : null}

      <CaseDetailBody caseId={caseId} fallbackCaseItem={caseItem} returnPath={returnPath} />
    </div>
  );
}

async function CaseDetailBody({
  caseId,
  fallbackCaseItem,
  returnPath,
}: {
  caseId: string;
  fallbackCaseItem: Awaited<ReturnType<typeof getCaseById>>;
  returnPath: string;
}) {
  const user = await withSectionTimeout(getCurrentUser(), "case current user", 1200).catch((error) => {
    console.error(`[case-detail] current user fallback for ${caseId}`, error);
    return getDefaultSeedUser();
  });
  const caseItem = await withSectionTimeout(getCaseById(caseId, user), "case detail", 1600).catch((error) => {
    console.error(`[case-detail] case detail fallback for ${caseId}`, error);
    return fallbackCaseItem;
  });
  const caseVoteQuestion = await withSectionTimeout(getCaseVoteQuestion(user, caseId), "case vote question", 1200).catch((error) => {
    console.error(`[case-detail] case vote fallback for ${caseId}`, error);
    return null;
  });

  if (!caseItem) {
    notFound();
  }

  return <CaseDetail caseItem={caseItem} user={user} returnPath={returnPath} voteQuestion={caseVoteQuestion} />;
}
