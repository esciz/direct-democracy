import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { markCivicDocumentSourceVerifiedAction } from "@/lib/civic-documents/actions";
import { getAdminDocumentIntakeSummary } from "@/lib/civic-documents/service";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value) : "Pending";
}

export default async function AdminDocumentsPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") {
    redirect("/profile");
  }

  const summary = await getAdminDocumentIntakeSummary();

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Civic document intake"
        description="Review manually acquired public documents, extraction runs, pending fields, source verification, and unmatched civic records."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/documents/review" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Review queue
            </Link>
            <Link href="/admin/enrichment" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Candidate enrichment
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Documents</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{summary.totalDocuments.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pending fields</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{summary.pendingFields.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Open issues</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{summary.openIssues.toLocaleString()}</p>
        </div>
      </section>

      <section className="space-y-3">
        {summary.recentDocuments.length ? (
          summary.recentDocuments.map((document) => (
            <article key={document.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-lg font-semibold text-white">{document.title}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {document.documentType} - {document.sourceName} - {formatDate(document.createdAt)}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {document.relatedEntityType}
                    {document.relatedEntityId ? ` - linked ${document.relatedEntityId}` : " - unmatched"}
                  </p>
                </div>
                <form action={markCivicDocumentSourceVerifiedAction}>
                  <input type="hidden" name="documentId" value={document.id} />
                  <button type="submit" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
                    {document.sourceVerified ? "Source verified" : "Mark source verified"}
                  </button>
                </form>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
            No civic documents imported yet. Place real files in data/imports and run npm run civic:import-documents.
          </div>
        )}
      </section>
    </div>
  );
}
