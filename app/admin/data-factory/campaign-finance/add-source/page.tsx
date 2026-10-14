import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { addCampaignFinanceSourceAction } from "@/lib/campaign-finance/actions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type AddSourcePageProps = {
  searchParams?: Promise<{ added?: string; targetType?: string; targetId?: string }>;
};

export default async function AddCampaignFinanceSourcePage({ searchParams }: AddSourcePageProps) {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") redirect("/profile");

  const params = searchParams ? await searchParams : {};
  const [candidates, officials] = await Promise.all([
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
  ]);
  const targetType = params.targetType === "official" ? "official" : "candidate";
  const targetRows = targetType === "official" ? officials : candidates;
  const defaultTargetId = params.targetId ?? targetRows[0]?.id ?? "";

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin · Campaign finance"
        title="Add finance source"
        description="Attach a campaign finance URL or filing-list fallback to a candidate or official. Source links can display publicly while detailed donor extraction stays pending."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/data-factory/campaign-finance" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Finance queue
            </Link>
            <Link href="/admin/data-factory/campaign-finance/upload" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Upload PDF
            </Link>
          </div>
        }
      />

      {params.added ? (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm font-semibold text-emerald-100">
          Campaign finance source saved for review.
        </div>
      ) : null}

      <form action={addCampaignFinanceSourceAction} className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="grid gap-5">
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

          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Source URL
            <input name="sourceUrl" type="url" required placeholder="https://..." className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600" />
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Source name
              <input name="sourceName" defaultValue="Campaign finance source" className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Document URL
              <input name="documentUrl" type="url" placeholder="https://..." className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600" />
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
            Save source
          </button>
        </div>
      </form>
    </div>
  );
}

