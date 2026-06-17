import { redirect } from "next/navigation";
import { CivicDocumentRelatedEntityType, DocumentFieldReviewStatus, DocumentReviewIssueStatus } from "@prisma/client";

import { PageIntro } from "@/components/ui/page-intro";
import { linkCivicDocumentAction, resolveDocumentReviewIssueAction, updateExtractedFieldReviewAction } from "@/lib/civic-documents/actions";
import { getAdminDocumentReviewQueue } from "@/lib/civic-documents/service";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

export default async function AdminDocumentReviewPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") {
    redirect("/profile");
  }

  const documents = await getAdminDocumentReviewQueue();

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Document review queue"
        description="Approve, edit, reject, link, or flag extracted public civic document fields before they enrich public pages."
      />

      {documents.length ? (
        <section className="space-y-4">
          {documents.map((document) => (
            <article key={document.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                <div>
                  <p className="text-lg font-semibold text-white">{document.title}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {document.documentType} - {document.sourceName} - {document.extractionRuns[0]?.status ?? "PENDING"}
                  </p>
                </div>
                <form action={linkCivicDocumentAction} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <input type="hidden" name="documentId" value={document.id} />
                  <select name="relatedEntityType" defaultValue={document.relatedEntityType} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100">
                    {Object.values(CivicDocumentRelatedEntityType).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <input
                    name="relatedEntityId"
                    defaultValue={document.relatedEntityId ?? ""}
                    placeholder="Related entity ID"
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  />
                  <button type="submit" className="dd-button-secondary rounded-xl px-4 py-2 text-sm font-semibold">
                    Link
                  </button>
                </form>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {document.extractedFields.map((field) => (
                  <form key={field.id} action={updateExtractedFieldReviewAction} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                    <input type="hidden" name="fieldId" value={field.id} />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{field.fieldName}</p>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300">{Math.round(field.confidenceScore * 100)}%</span>
                    </div>
                    <textarea
                      name="fieldValue"
                      defaultValue={field.fieldValue}
                      rows={3}
                      className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <select name="reviewStatus" defaultValue={field.reviewStatus} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100">
                        {Object.values(DocumentFieldReviewStatus).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="dd-button-primary rounded-xl px-4 py-2 text-sm font-semibold">
                        Save review
                      </button>
                    </div>
                  </form>
                ))}
              </div>

              {document.reviewIssues.length ? (
                <div className="mt-5 space-y-2">
                  {document.reviewIssues.map((issue) => (
                    <form key={issue.id} action={resolveDocumentReviewIssueAction} className="flex flex-col gap-3 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 md:flex-row md:items-center md:justify-between">
                      <input type="hidden" name="issueId" value={issue.id} />
                      <p className="text-sm text-amber-100">
                        {issue.issueType} - {issue.notes ?? "Review needed"}
                      </p>
                      <select name="status" defaultValue={issue.status} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100">
                        {Object.values(DocumentReviewIssueStatus).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="dd-button-secondary rounded-xl px-4 py-2 text-sm font-semibold">
                        Update issue
                      </button>
                    </form>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
          No pending document extraction fields or review issues.
        </div>
      )}
    </div>
  );
}
