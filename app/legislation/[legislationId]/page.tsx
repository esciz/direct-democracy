import { notFound } from "next/navigation";

import { ContactOfficialsPanel } from "@/components/domain/contact-officials-panel";
import { DraftLegislationCard } from "@/components/domain/draft-legislation-card";
import { LegislationCollaborationPanel } from "@/components/domain/legislation-collaboration-panel";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getContactOfficialsPanelData } from "@/lib/contact/store";
import { getDraftLegislationDetail } from "@/lib/petitions/collaboration";

type DraftLegislationPageProps = {
  params: Promise<{
    legislationId: string;
  }>;
  searchParams?: Promise<{
    collaboration?: string;
    collaborationError?: string;
  }>;
};

export default async function DraftLegislationPage({ params, searchParams }: DraftLegislationPageProps) {
  const { legislationId } = await params;
  const user = await getCurrentUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const legislation = await getDraftLegislationDetail(legislationId);

  if (!legislation) {
    notFound();
  }

  const contactPanel = await getContactOfficialsPanelData({
    entityId: legislation.id,
    entityType: "legislation",
    contextTitle: legislation.title,
    contextSummary: legislation.summary,
    jurisdictionName: legislation.jurisdictionName,
    issueLabels: [legislation.title, legislation.summary],
    userName: user.name,
    preferredOfficialIds: [legislation.sponsorOfficialId],
  });

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Draft legislation"
        title={legislation.title}
        description="A lightweight MVP view of how a petition can progress into a public drafting stage, with structured public suggestions from petition signers."
        meta={
          <>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              {legislation.status}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {legislation.jurisdictionName}
            </span>
          </>
        }
      />

      {resolvedSearchParams?.collaboration === "suggestion" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your structured suggestion was added to the draft collaboration queue.
        </section>
      ) : null}
      {resolvedSearchParams?.collaboration === "vote" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your draft suggestion vote was recorded.
        </section>
      ) : null}
      {resolvedSearchParams?.collaborationError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {resolvedSearchParams.collaborationError === "permissions" && "Only people who signed the linked petition can suggest changes or vote on them."}
          {resolvedSearchParams.collaborationError === "invalid" && "That drafting action could not be completed."}
        </section>
      ) : null}

      <DraftLegislationCard legislation={legislation} />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-700">Draft text</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Current working summary</h2>
        <p className="mt-4 text-sm leading-7 text-slate-700">{legislation.body}</p>
      </section>

      <LegislationCollaborationPanel legislation={legislation} />

      <ContactOfficialsPanel panel={contactPanel} />
    </div>
  );
}
