import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { uploadCampaignFinancePdfAction } from "@/lib/campaign-finance/actions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type UploadPageProps = {
  searchParams?: Promise<{ uploaded?: string; targetType?: string; targetId?: string }>;
};

export default async function UploadCampaignFinancePdfPage({ searchParams }: UploadPageProps) {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") redirect("/profile");

  const params = searchParams ? await searchParams : {};
  const [candidates, officials, recentUploads] = await Promise.all([
    prisma.candidate.findMany({
      include: { office: { select: { title: true } }, jurisdiction: { select: { name: true } } },
      orderBy: [{ updatedAt: "desc" }, { fullName: "asc" }],
      take: 300,
    }),
    prisma.official.findMany({
      include: { office: { select: { title: true } }, jurisdiction: { select: { name: true } } },
      orderBy: [{ updatedAt: "desc" }, { fullName: "asc" }],
      take: 300,
    }),
    prisma.civicDocument.findMany({
      where: { documentType: "CAMPAIGN_FINANCE_FILING" },
      include: { extractionRuns: { orderBy: { startedAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);
  const targetType = params.targetType === "official" ? "official" : "candidate";
  const targetRows = targetType === "official" ? officials : candidates;
  const defaultTargetId = params.targetId ?? targetRows[0]?.id ?? "";

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin · Campaign finance"
        title="Upload finance PDF"
        description="Upload a public finance filing PDF, link it to a profile, and stage extracted text/fields for review before any totals are published."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/data-factory/campaign-finance" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Finance queue
            </Link>
            <Link href="/admin/data-factory/campaign-finance/add-source" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Add source
            </Link>
            <Link href="/admin/documents/review" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Review fields
            </Link>
          </div>
        }
      />

      {params.uploaded ? (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm font-semibold text-emerald-100">
          PDF uploaded, linked, and staged for document review.
        </div>
      ) : null}

      <form action={uploadCampaignFinancePdfAction} className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Target type
              <select name="targetType" defaultValue={targetType} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100">
                <option value="candidate">Candidate</option>
                <option value="official">Official</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Target
              <select name="targetId" defaultValue={defaultTargetId} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100">
                {targetRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {"ballotName" in row ? row.ballotName ?? row.fullName : row.fullName} - {row.office?.title ?? "Office"} - {row.jurisdiction.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            PDF
            <input name="pdf" type="file" accept="application/pdf,.pdf" required className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-300 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950" />
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Source name
              <input name="sourceName" defaultValue="Manual campaign finance PDF upload" className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Source URL
              <input name="sourceUrl" type="url" placeholder="https://..." className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Document URL
              <input name="documentUrl" type="url" placeholder="https://..." className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Committee name
              <input name="committeeName" className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Report name
              <input name="reportName" placeholder="CE Report 1" className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Report year
              <input name="reportYear" inputMode="numeric" placeholder="2026" className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Filing date
              <input name="filingDate" type="date" className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100" />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Notes
            <textarea name="notes" rows={4} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-slate-100" />
          </label>

          <button className="dd-button-primary rounded-full px-5 py-3 text-sm font-semibold" type="submit">
            Upload PDF
          </button>
        </div>
      </form>

      <section className="space-y-3">
        {recentUploads.map((document) => (
          <article key={document.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-semibold text-white">{document.title}</p>
                <p className="mt-1 text-sm text-slate-400">{document.relatedEntityType} · {document.relatedEntityId ?? "unlinked"} · {document.extractionRuns[0]?.status ?? "PENDING"}</p>
              </div>
              <Link href={`/admin/data-factory/campaign-finance/download/${document.id}`} className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
                Download
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

